import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import fs from 'node:fs';
import { prisma } from '../src/lib/db';

interface DetectedFace {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  embedding: number[];
  thumbnailFilename?: string;
}

interface PhotoResult {
  photoId: string;
  imagePath: string;
  dimensions: { width: number; height: number };
  timeMs: number;
  facesFound: number;
  faces: DetectedFace[];
}

interface WorkerResponse {
  success: boolean;
  photoId: string;
  faces?: DetectedFace[];
  error?: string;
}

async function main() {
  console.log('================================================================================');
  console.log('STEP 0: BASELINE MEASUREMENT USING REAL WORKER PIPELINE (20 PHOTOS)');
  console.log('================================================================================\n');

  // 1. Fetch the 20 benchmark photos (ordered by createdAt: desc from event "nepal trip 2")
  const event = await prisma.event.findFirst({
    where: { name: { contains: 'nepal trip 2', mode: 'insensitive' } },
  });

  if (!event) {
    throw new Error('Event "nepal trip 2" not found in database.');
  }

  const photos = await prisma.photo.findMany({
    where: { eventId: event.id, isDeleted: false },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (photos.length !== 20) {
    throw new Error(`Expected 20 photos, but found ${photos.length}.`);
  }

  console.log(`Loaded ${photos.length} photos for event "${event.name}" (${event.id}).`);

  const pythonPath = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(process.cwd(), 'worker', 'face_cli.py');
  const facesOutputDir = path.resolve(process.cwd(), 'storage', 'faces');

  if (!fs.existsSync(facesOutputDir)) {
    fs.mkdirSync(facesOutputDir, { recursive: true });
  }

  console.log(`Python Path: ${pythonPath}`);
  console.log(`Script Path: ${scriptPath}`);
  console.log(`FACE_THREADS: ${process.env.FACE_THREADS || 'default (6)'}`);
  console.log(`Starting real worker daemon...\n`);

  const child = spawn(
    pythonPath,
    [scriptPath, 'worker', '--outputDir', facesOutputDir],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );

  let isReady = false;
  let readyResolve: () => void;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });

  child.stderr?.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('[FaceWorker Python] Initialized and ready.')) {
      isReady = true;
      readyResolve();
    }
    // Print worker init / thread logs
    process.stderr.write(msg);
  });

  child.on('error', (err) => {
    console.error('[Worker Process Error]:', err);
  });

  const rl = readline.createInterface({
    input: child.stdout!,
    terminal: false,
  });

  let currentResolve: ((resp: WorkerResponse) => void) | null = null;
  let currentReject: ((err: Error) => void) | null = null;

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as WorkerResponse;
      if (currentResolve) {
        const res = currentResolve;
        currentResolve = null;
        currentReject = null;
        res(parsed);
      }
    } catch (e) {
      if (currentReject) {
        const rej = currentReject;
        currentResolve = null;
        currentReject = null;
        rej(new Error(`Failed to parse worker output: ${trimmed}`));
      }
    }
  });

  // Wait for worker to be ready
  await readyPromise;
  console.log('[Worker Daemon] Ready. Processing 20 photos...\n');

  function sendTask(task: any): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      currentResolve = resolve;
      currentReject = reject;
      child.stdin?.write(JSON.stringify(task) + '\n');
    });
  }

  const results: PhotoResult[] = [];
  const tTotalStart = performance.now();

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const imageFullPath = path.resolve(process.cwd(), 'storage', p.asset.storageKeyOriginal);

    const t0 = performance.now();
    const resp = await sendTask({
      action: 'detect',
      imagePath: imageFullPath,
      photoId: p.id,
      conf: 0.65,
      minFaceSize: 45,
    });
    const elapsedMs = Number((performance.now() - t0).toFixed(2));

    if (!resp.success) {
      console.error(`[Error on photo ${p.id}]:`, resp.error);
    }

    const faces = resp.faces || [];
    results.push({
      photoId: p.id,
      imagePath: imageFullPath,
      dimensions: { width: p.asset.width || 0, height: p.asset.height || 0 },
      timeMs: elapsedMs,
      facesFound: faces.length,
      faces: faces.map((f) => ({
        boundingBox: f.boundingBox,
        confidence: f.confidence,
        embedding: f.embedding,
        thumbnailFilename: f.thumbnailFilename,
      })),
    });

    console.log(
      `[${String(i + 1).padStart(2, ' ')}/20] Photo ${p.id.slice(0, 10)}... | ${p.asset.width}x${p.asset.height} | Faces: ${String(faces.length).padStart(2, ' ')} | Time: ${elapsedMs.toFixed(1)} ms`
    );
  }

  const tTotalMs = Number((performance.now() - tTotalStart).toFixed(2));

  // Stop daemon
  child.stdin?.write('QUIT\n');
  child.stdin?.end();

  const totalFaces = results.reduce((acc, r) => acc + r.facesFound, 0);
  const times = results.map((r) => r.timeMs);
  const sortedTimes = [...times].sort((a, b) => a - b);
  const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
  const avgTime = Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(2));

  const baselineData = {
    timestamp: new Date().toISOString(),
    config: {
      photosCount: results.length,
      faceThreads: process.env.FACE_THREADS || '6',
      pythonPath,
      scriptPath,
    },
    summary: {
      totalTimeMs: tTotalMs,
      totalFaces,
      avgTimePerPhotoMs: avgTime,
      medianTimePerPhotoMs: medianTime,
      photosPerSec: Number((results.length / (tTotalMs / 1000)).toFixed(2)),
    },
    photos: results,
  };

  const baselinePath = path.resolve(process.cwd(), 'baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify(baselineData, null, 2), 'utf-8');

  console.log('\n================================================================================');
  console.log('STEP 0 BASELINE SUMMARY');
  console.log('================================================================================');
  console.log(`Total Photos Processed : ${results.length}`);
  console.log(`Total Faces Found      : ${totalFaces}`);
  console.log(`Total Elapsed Time     : ${(tTotalMs / 1000).toFixed(2)} s`);
  console.log(`Average Time per Photo : ${avgTime.toFixed(1)} ms`);
  console.log(`Median Time per Photo  : ${medianTime.toFixed(1)} ms`);
  console.log(`Throughput             : ${(results.length / (tTotalMs / 1000)).toFixed(2)} photos/sec`);
  console.log(`Saved baseline to      : ${baselinePath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
