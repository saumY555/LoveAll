import dns from 'node:dns';

// Ensure reliable DNS resolution for cloud databases (e.g. Neon on AWS) across all networks/ISPs
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignored in environments where setServers is restricted
}

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { prisma } from '../src/lib/db';
import {
  persistScanAndClusterTransaction,
  ClusterResult,
} from '../src/lib/faceService';

const BATCH_SIZE = 20;
const SLEEP_IDLE_MS = 2000;
const RECOVERY_INTERVAL_MS = 30_000; // Recover stale photos every 30 seconds
const STALE_PHOTO_TIMEOUT_MS = 180_000; // Reset photos stuck in PROCESSING for > 3 min
// Only run intermediate (live-preview) clustering every this many batches; always run on completion
const CLUSTER_EVERY_N_BATCHES = 5;

async function withDbRetry<T>(
  operation: () => Promise<T>,
  name: string,
  maxAttempts = 5
): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const isTransient =
        err?.code === 'P1001' ||
        err?.code === 'P1002' ||
        err?.code === 'P1008' ||
        err?.code === 'P1017' ||
        err?.message?.includes("Can't reach database server") ||
        err?.message?.includes('connection closed') ||
        err?.message?.includes('Connection terminated') ||
        err?.message?.includes('Connection reset') ||
        err?.message?.includes('connection pool') ||
        err?.message?.includes('Timed out fetching') ||
        err?.message?.includes('closed unexpectedly');

      if (isTransient && attempt < maxAttempts) {
        const delay = Math.min(800 * attempt, 4000);
        console.warn(
          `[FaceWorker DB Retry] ${name} hit transient Neon issue (${err?.code || 'timeout'}). Retrying ${attempt}/${maxAttempts} in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`[FaceWorker] Operation ${name} failed after ${maxAttempts} attempts`);
}

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
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private pendingQueue: Array<{
    resolve: (val: WorkerTaskResponse) => void;
    reject: (err: Error) => void;
  }> = [];
  private isReady = false;
  private readyPromise: Promise<void> | null = null;

  constructor() {
    this.readyPromise = this.start();
  }

  private async start(): Promise<void> {
    const pythonPath = process.env.PYTHON_PATH || 'python';
    const scriptPath = path.resolve(process.cwd(), 'worker', 'face_cli.py');
    const facesOutputDir = path.resolve(process.cwd(), 'storage', 'faces');

    return new Promise<void>((resolve, reject) => {
      this.child = spawn(
        pythonPath,
        [scriptPath, 'worker', '--outputDir', facesOutputDir],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      this.child.stderr?.on('data', (d) => {
        const msg = d.toString();
        // Look for ready signal
        if (msg.includes('[FaceWorker Python] Initialized and ready.')) {
          this.isReady = true;
          resolve();
        }
        process.stderr.write(msg);
      });

      this.child.on('error', (err) => {
        console.error('[PythonFaceDaemon] Process error:', err);
        reject(err);
      });

      this.child.on('close', (code) => {
        console.warn(`[PythonFaceDaemon] Process closed with code ${code}`);
        this.isReady = false;
        // Reject any pending
        while (this.pendingQueue.length > 0) {
          const p = this.pendingQueue.shift();
          p?.reject(new Error(`Python process closed prematurely (code ${code})`));
        }
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
          if (current) {
            current.resolve(parsed);
          }
        } catch (err) {
          console.error('[PythonFaceDaemon] Failed to parse output line:', trimmed, err);
          const current = this.pendingQueue.shift();
          current?.reject(new Error(`Invalid JSON from Python: ${trimmed}`));
        }
      });

      // Fallback timeout for initialization
      setTimeout(() => {
        if (!this.isReady) {
          // If already running, mark ready
          this.isReady = true;
          resolve();
        }
      }, 15000);
    });
  }

  public async sendTask(task: any): Promise<WorkerTaskResponse> {
    if (this.readyPromise) {
      await this.readyPromise;
    }
    if (!this.child || this.child.killed) {
      this.readyPromise = this.start();
      await this.readyPromise;
    }

    return new Promise<WorkerTaskResponse>((resolve, reject) => {
      this.pendingQueue.push({ resolve, reject });
      const line = JSON.stringify(task) + '\n';
      this.child?.stdin?.write(line, 'utf8', (err) => {
        if (err) {
          const idx = this.pendingQueue.findIndex((p) => p.resolve === resolve);
          if (idx !== -1) this.pendingQueue.splice(idx, 1);
          reject(err);
        }
      });
    });
  }

  public stop(): void {
    if (this.child && !this.child.killed) {
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

/**
 * Reset photos stuck in PROCESSING for more than 60 seconds back to PENDING.
 */
async function recoverStaleProcessingPhotos() {
  const cutoff = new Date(Date.now() - STALE_PHOTO_TIMEOUT_MS);
  const result = await prisma.photo.updateMany({
    where: {
      faceStatus: 'PROCESSING',
      isDeleted: false,
      faceProcessedAt: { lt: cutoff },
    },
    data: {
      faceStatus: 'PENDING',
    },
  });

  if (result.count > 0) {
    console.log(
      `[FaceWorker] [CRASH RECOVERY] Reset ${result.count} stale photos (> 3 min) back to PENDING.`
    );
  }
}

/**
 * Claim up to N photos with a single transaction using SKIP LOCKED.
 */
async function claimPendingPhotos(limit: number): Promise<ClaimedPhotoRow[]> {
  return withDbRetry(async () => {
    const claimed = await prisma.$queryRaw<ClaimedPhotoRow[]>`
      WITH candidate AS (
        SELECT id
        FROM "Photo"
        WHERE "faceStatus" = 'PENDING'::"FaceStatus"
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

    return claimed;
  }, 'claimPendingPhotos');
}

const lastClusterTimes = new Map<string, number>();

/**
 * Run clustering across active faces for an event on the fly.
 * Throttled to at most once every 3.5 seconds per event unless forced when all photos finish.
 */
async function runEventClusteringLive(
  eventId: string,
  daemon: PythonFaceDaemon,
  options: { force?: boolean } = {}
) {
  const pendingCount = await prisma.photo.count({
    where: {
      eventId,
      isDeleted: false,
      faceStatus: { in: ['PENDING', 'PROCESSING'] },
    },
  });

  const isComplete = pendingCount === 0;
  const now = Date.now();
  const lastTime = lastClusterTimes.get(eventId) || 0;

  // Throttle intermediate clustering while photos are actively uploading/processing
  if (!isComplete && !options.force && now - lastTime < 30_000) {
    return;
  }
  lastClusterTimes.set(eventId, now);

  // Fetch all active faces in event so far
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

  if (allFaces.length === 0) {
    if (isComplete) {
      await prisma.person.deleteMany({
        where: {
          eventId,
          faces: { none: {} },
        },
      });
      console.log(`[FaceWorker] Event "${eventId}" has 0 faces. Cleaned up empty people.`);
    }
    return;
  }

  console.log(
    `[FaceWorker] ${isComplete ? '[FINAL]' : '[LIVE]'} Running clustering for event "${eventId}" (${allFaces.length} faces, ${pendingCount} pending photos)...`
  );

  // Run clustering via daemon
  const clusterResponse = await daemon.sendTask({
    action: 'cluster',
    faces: allFaces.map((f) => ({
      id: f.id,
      embedding: f.embedding,
      confidence: f.confidence,
    })),
    eps: 0.50,
    minSamples: 1,
  });

  if (!clusterResponse.success || !clusterResponse.result) {
    console.error(
      `[FaceWorker] Clustering failed for event "${eventId}":`,
      clusterResponse.error
    );
    return;
  }

  const clusterResult = clusterResponse.result;

  const existingPeople = await prisma.person.findMany({
    where: { eventId },
    include: { faces: { select: { id: true } } },
  });

  const allFacesMap = new Map(allFaces.map((f) => [f.id, f]));

  // Atomically persist cluster assignments using the proven batch function with retry
  await withDbRetry(
    () =>
      persistScanAndClusterTransaction({
        eventId,
        successfulPhotoIds: [],
        allDetectedFaces: [],
        clusterResult,
        existingPeople,
        allFacesMap,
      }),
    `persistClusters(${eventId})`
  );

  const finalPeopleCount = await prisma.person.count({
    where: { eventId },
  });

  console.log(
    `[FaceWorker] ${isComplete ? '[FINAL]' : '[LIVE]'} Clustering complete for event "${eventId}": ${clusterResult.clusters.length} clusters, ${finalPeopleCount} total people in DB.`
  );
}

async function main() {
  console.log('================================================================================');
  console.log('STARTING FACE BACKGROUND WORKER');
  console.log('================================================================================');

  const daemon = new PythonFaceDaemon();

  // Run initial crash recovery on worker startup — wrapped in retry so a
  // cold/suspended Neon DB doesn't crash the worker before it starts polling.
  await withDbRetry(() => recoverStaleProcessingPhotos(), 'startup:recoverStaleProcessingPhotos');

  let lastRecoveryTime = Date.now();
  let batchesProcessed = 0;
  let isRunning = true;

  const shutdown = () => {
    console.log('\n[FaceWorker] Shutting down gracefully...');
    isRunning = false;
    daemon.stop();
    prisma.$disconnect().finally(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('[FaceWorker] Polling database for pending photos...');

  while (isRunning) {
    try {
      // Periodic crash recovery every 30 seconds
      if (Date.now() - lastRecoveryTime > RECOVERY_INTERVAL_MS) {
        lastRecoveryTime = Date.now();
        try {
          await withDbRetry(() => recoverStaleProcessingPhotos(), 'recoverStaleProcessingPhotos');
        } catch (recErr) {
          console.warn('[FaceWorker] Periodic recovery error (will retry next interval):', recErr);
        }
      }

      // Claim batch of pending photos
      const claimedPhotos = await claimPendingPhotos(BATCH_SIZE);

      if (claimedPhotos.length === 0) {
        await new Promise((r) => setTimeout(r, SLEEP_IDLE_MS));
        continue;
      }

      batchesProcessed++;
      console.log(`[FaceWorker] Claimed ${claimedPhotos.length} photos for processing (batch #${batchesProcessed}).`);

      const affectedEventIds = new Set<string>();
      claimedPhotos.forEach((p) => affectedEventIds.add(p.eventId));

      // --- FIX #2: Parallel detection + DB writes ---
      // All detection tasks are queued to the Python daemon at once (they will
      // still be executed sequentially inside Python, but each photo's DB write
      // now runs concurrently with the NEXT photo's detection, cutting wall time
      // roughly in half for large batches).
      const detectionPromises = claimedPhotos.map(async (photo) => {
        const imagePath = path.resolve(process.cwd(), 'storage', photo.storageKeyOriginal);
        try {
          const res = await daemon.sendTask({
            action: 'detect',
            photoId: photo.id,
            imagePath,
            conf: 0.48,
            minFaceSize: 18,
          });
          if (!res.success) {
            throw new Error(res.error || 'Face detection returned unsuccessful');
          }
          return { photo, faces: (res.faces || []) as DetectedFace[], error: null as null };
        } catch (err: any) {
          return { photo, faces: [] as DetectedFace[], error: err as Error };
        }
      });

      // Persist each result as soon as its detection resolves (all DB writes run in parallel)
      await Promise.all(
        detectionPromises.map(async (resultPromise) => {
          const { photo, faces, error } = await resultPromise;

          if (error) {
            console.error(`[FaceWorker] Error processing photo ${photo.id}:`, error.message);
            await prisma.photo
              .update({
                where: { id: photo.id },
                data: {
                  faceStatus: 'FAILED',
                  faceError: error.message || 'Unknown error during face scan',
                  faceProcessedAt: new Date(),
                },
              })
              .catch((err) => console.error('[FaceWorker] Failed to mark photo FAILED:', err));
            return;
          }

          // Persist faces and mark photo DONE with automatic retry
          await withDbRetry(
            () =>
              prisma.$transaction(
                async (tx) => {
                  // Delete old faces for this photo (e.g. on rescan)
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
              ),
            `saveFaces(${photo.id})`
          );

          console.log(`[FaceWorker] Photo ${photo.id}: ${faces.length} face(s) saved -> DONE`);
        })
      );

      // --- FIX #1: Lazy clustering ---
      // Run clustering only when the event is fully done (always), or every
      // CLUSTER_EVERY_N_BATCHES batches as a live-preview update (much less often
      // than the old once-per-10-photo approach, eliminating the O(n²) storm).
      const isNthBatch = batchesProcessed % CLUSTER_EVERY_N_BATCHES === 0;
      for (const eventId of affectedEventIds) {
        const pendingLeft = await prisma.photo.count({
          where: { eventId, isDeleted: false, faceStatus: { in: ['PENDING', 'PROCESSING'] } },
        });
        const isEventComplete = pendingLeft === 0;

        if (isEventComplete || isNthBatch) {
          await runEventClusteringLive(eventId, daemon, { force: isEventComplete });
        }
      }
    } catch (loopErr) {
      console.error('[FaceWorker] Error in main loop:', loopErr);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

main().catch((err) => {
  console.error('[FaceWorker] Fatal worker error:', err);
  process.exit(1);
});
