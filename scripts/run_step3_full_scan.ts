import path from 'node:path';
import { prisma } from '../src/lib/db';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import crypto from 'node:crypto';
import {
  persistScanAndClusterTransaction,
  ClusterResult,
} from '../src/lib/faceService';

const BATCH_SIZE = 10;

interface DetectedFace {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  embedding: number[];
  thumbnailFilename: string;
}

interface WorkerTaskResponse {
  success: boolean;
  photoId?: string;
  faces?: DetectedFace[];
  result?: ClusterResult;
  error?: string;
}

class PythonFaceDaemon {
  private child: any = null;
  private rl: readline.Interface | null = null;
  private pendingQueue: Array<{
    resolve: (val: WorkerTaskResponse) => void;
    reject: (err: Error) => void;
  }> = [];
  public isReady = false;

  public async start(): Promise<void> {
    const pythonPath = process.env.PYTHON_PATH || 'python';
    const scriptPath = path.resolve(process.cwd(), 'worker', 'face_cli.py');
    const facesOutputDir = path.resolve(process.cwd(), 'storage', 'faces');

    return new Promise<void>((resolve, reject) => {
      this.child = spawn(
        pythonPath,
        [scriptPath, 'worker', '--outputDir', facesOutputDir, '--threads', '6'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, FACE_THREADS: '6' },
        }
      );

      this.child.stderr?.on('data', (d: Buffer) => {
        const msg = d.toString();
        if (msg.includes('[FaceWorker Python] Initialized and ready.')) {
          this.isReady = true;
          resolve();
        }
      });

      this.child.on('error', (err: Error) => {
        reject(err);
      });

      this.rl = readline.createInterface({
        input: this.child.stdout!,
        terminal: false,
      });

      this.rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const parsed = JSON.parse(trimmed) as WorkerTaskResponse;
          const current = this.pendingQueue.shift();
          if (current) current.resolve(parsed);
        } catch (err) {
          const current = this.pendingQueue.shift();
          current?.reject(new Error(`Invalid JSON: ${trimmed}`));
        }
      });
    });
  }

  public async sendTask(task: any): Promise<WorkerTaskResponse> {
    return new Promise<WorkerTaskResponse>((resolve, reject) => {
      this.pendingQueue.push({ resolve, reject });
      this.child?.stdin?.write(JSON.stringify(task) + '\n');
    });
  }

  public stop(): void {
    if (this.child) {
      try {
        this.child.stdin?.write('QUIT\n');
        this.child.stdin?.end();
      } catch {
        this.child.kill();
      }
    }
  }
}

interface ClaimedPhotoRow {
  id: string;
  eventId: string;
  assetId: string;
  storageKeyOriginal: string;
}

async function claimPendingPhotosForEvent(eventId: string, limit: number): Promise<ClaimedPhotoRow[]> {
  return await prisma.$queryRaw<ClaimedPhotoRow[]>`
    WITH candidate AS (
      SELECT id
      FROM "Photo"
      WHERE "eventId" = ${eventId}
        AND "faceStatus" = 'PENDING'::"FaceStatus"
        AND "isDeleted" = false
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    ),
    updated AS (
      UPDATE "Photo" p
      SET "faceStatus" = 'PROCESSING'::"FaceStatus",
          "faceProcessedAt" = NOW()
      FROM candidate c
      WHERE p.id = c.id
      RETURNING p.id, p."eventId", p."assetId"
    )
    SELECT u.id, u."eventId", u."assetId", pa."storageKeyOriginal"
    FROM updated u
    JOIN "PhotoAsset" pa ON pa.id = u."assetId"
  `;
}

async function runClustering(eventId: string, daemon: PythonFaceDaemon) {
  console.log(`\n[Clustering] Fetching all faces for event "${eventId}"...`);
  const allFaces = await prisma.face.findMany({
    where: {
      photo: {
        eventId,
        isDeleted: false,
      },
    },
    select: {
      id: true,
      embedding: true,
      confidence: true,
      thumbnailUrl: true,
    },
  });

  console.log(`[Clustering] Found ${allFaces.length} total faces. Running DBSCAN/Agglomerative clustering...`);

  const clusterResponse = await daemon.sendTask({
    action: 'cluster',
    faces: allFaces.map((f) => ({
      id: f.id,
      embedding: f.embedding,
      confidence: f.confidence,
    })),
    eps: 0.50,
    minSamples: 2,
  });

  if (!clusterResponse.success || !clusterResponse.result) {
    throw new Error(`Clustering failed: ${clusterResponse.error}`);
  }

  const clusterResult = clusterResponse.result;

  const existingPeople = await prisma.person.findMany({
    where: { eventId },
    include: { faces: { select: { id: true } } },
  });

  const allFacesMap = new Map(allFaces.map((f) => [f.id, f]));

  await persistScanAndClusterTransaction({
    eventId,
    successfulPhotoIds: [],
    allDetectedFaces: [],
    clusterResult,
    existingPeople,
    allFacesMap,
  });

  const finalPeopleCount = await prisma.person.count({ where: { eventId } });
  console.log(`[Clustering] Done! Created/Updated ${finalPeopleCount} people clusters.`);
}

async function main() {
  console.log('================================================================================');
  console.log('STEP 3: FULL RESCAN & CLUSTERING OF REAL EVENT (199 PHOTOS)');
  console.log('================================================================================\n');

  const event = await prisma.event.findFirst({
    where: { name: { contains: 'nepal trip 2', mode: 'insensitive' } },
  });

  if (!event) {
    throw new Error('Event "nepal trip 2" not found');
  }

  const totalPhotos = await prisma.photo.count({
    where: { eventId: event.id, isDeleted: false },
  });

  console.log(`Target Event: "${event.name}" (${event.id})`);
  console.log(`Total Photos: ${totalPhotos}`);

  // 1. Mark all photos in event as PENDING (matching POST /api/events/[eventId]/faces/scan?force=true)
  console.log(`\nMarking all ${totalPhotos} photos as PENDING...`);
  await prisma.photo.updateMany({
    where: { eventId: event.id, isDeleted: false },
    data: { faceStatus: 'PENDING', faceError: null },
  });

  console.log('Starting Python Face Engine worker daemon (FACE_THREADS=6)...');
  const daemon = new PythonFaceDaemon();
  await daemon.start();
  console.log('Worker daemon ready.\n');

  let processedCount = 0;
  let totalFacesFound = 0;

  const t0Start = performance.now();

  while (true) {
    const claimed = await claimPendingPhotosForEvent(event.id, BATCH_SIZE);
    if (claimed.length === 0) {
      break;
    }

    for (const photo of claimed) {
      const imagePath = path.resolve(process.cwd(), 'storage', photo.storageKeyOriginal);

      try {
        const res = await daemon.sendTask({
          action: 'detect',
          photoId: photo.id,
          imagePath,
          conf: 0.65,
          minFaceSize: 45,
        });

        if (!res.success) {
          throw new Error(res.error || 'Face detection unsuccessful');
        }

        const faces = res.faces || [];
        totalFacesFound += faces.length;

        // Persist faces and mark photo DONE
        await prisma.$transaction(
          async (tx) => {
            await tx.face.deleteMany({ where: { photoId: photo.id } });
            if (faces.length > 0) {
              await tx.face.createMany({
                data: faces.map((f) => ({
                  id: crypto.randomUUID(),
                  photoId: photo.id,
                  boundingBox: f.boundingBox,
                  embedding: f.embedding,
                  confidence: f.confidence,
                  thumbnailUrl: `/api/faces/${f.thumbnailFilename}`,
                  isNoise: false,
                })),
              });
            }
            await tx.photo.update({
              where: { id: photo.id },
              data: {
                faceStatus: 'DONE',
                faceProcessedAt: new Date(),
                faceError: null,
              },
            });
          },
          { maxWait: 15000, timeout: 15000 }
        );

        processedCount++;
        if (processedCount % 20 === 0 || processedCount === totalPhotos) {
          const elapsedSec = ((performance.now() - t0Start) / 1000).toFixed(1);
          const pps = (processedCount / (Number(elapsedSec) || 1)).toFixed(2);
          console.log(
            `  [Progress] Processed ${processedCount}/${totalPhotos} photos (${totalFacesFound} faces) | Elapsed: ${elapsedSec}s | Speed: ${pps} photos/sec`
          );
        }
      } catch (photoErr: any) {
        console.error(`Error processing photo ${photo.id}:`, photoErr.message);
        await prisma.photo.update({
          where: { id: photo.id },
          data: {
            faceStatus: 'FAILED',
            faceError: photoErr.message,
            faceProcessedAt: new Date(),
          },
        });
      }
    }
  }

  const tDetectionEnd = performance.now();
  const detectionElapsedSec = ((tDetectionEnd - t0Start) / 1000).toFixed(2);
  console.log(`\nAll photos processed in ${detectionElapsedSec} s.`);

  // 2. Run clustering
  await runClustering(event.id, daemon);

  const tTotalEnd = performance.now();
  const totalElapsedSec = ((tTotalEnd - t0Start) / 1000).toFixed(2);

  daemon.stop();

  // 3. Final verification against baseline
  const finalPhotosDone = await prisma.photo.count({
    where: { eventId: event.id, faceStatus: 'DONE', isDeleted: false },
  });
  const finalFaces = await prisma.face.count({
    where: { photo: { eventId: event.id, isDeleted: false } },
  });
  const finalPeople = await prisma.person.count({
    where: { eventId: event.id },
  });

  console.log('\n================================================================================');
  console.log('STEP 3 FINAL RESULTS');
  console.log('================================================================================');
  console.log(`Total Elapsed Time:  ${totalElapsedSec} s`);
  console.log(`Photos Processed:    ${finalPhotosDone} / ${totalPhotos}`);
  console.log(`Faces Found:         ${finalFaces} (Baseline: 330)`);
  console.log(`Clusters / People:   ${finalPeople} (Baseline: 19)`);
  console.log(`Overall Throughput:  ${(totalPhotos / Number(totalElapsedSec)).toFixed(2)} photos/sec`);
  console.log('================================================================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
