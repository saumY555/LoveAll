import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import fs from 'node:fs';
import { prisma } from '../src/lib/db';

interface PhotoItem {
  id: string;
  imageFullPath: string;
  width: number;
  height: number;
}

interface RunPhotoResult {
  photoId: string;
  facesFound: number;
  timeMs: number;
}

interface SingleRunResult {
  runIndex: number;
  totalTimeMs: number;
  photosPerSec: number;
  photos: RunPhotoResult[];
  zeroFaceTimesMs: number[];
}

interface ThreadSweepConfigResult {
  threads: number;
  runs: SingleRunResult[];
  medianRun: SingleRunResult;
  stats: {
    medianSecPerPhoto: number;
    avgSecPerPhoto: number;
    minSecPerPhoto: number;
    maxSecPerPhoto: number;
    medianPhotosPerSec: number;
    minPhotosPerSec: number;
    maxPhotosPerSec: number;
    zeroFaceMedianMs: number;
    zeroFaceMinMs: number;
    zeroFaceMaxMs: number;
  };
}

async function runWorkerSession(
  photos: PhotoItem[],
  threads: number,
  runIndex: number
): Promise<SingleRunResult> {
  const pythonPath = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(process.cwd(), 'worker', 'face_cli.py');
  const facesOutputDir = path.resolve(process.cwd(), 'storage', 'faces');

  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonPath,
      [scriptPath, 'worker', '--outputDir', facesOutputDir, '--threads', String(threads)],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FACE_THREADS: String(threads) },
      }
    );

    let isReady = false;
    let currentResolve: ((resp: any) => void) | null = null;
    let currentReject: ((err: Error) => void) | null = null;

    child.stderr?.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('[FaceWorker Python] Initialized and ready.')) {
        isReady = true;
        startProcessing();
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    const rl = readline.createInterface({
      input: child.stdout!,
      terminal: false,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed);
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
          rej(new Error(`Failed to parse: ${trimmed}`));
        }
      }
    });

    function sendTask(task: any): Promise<any> {
      return new Promise((res, rej) => {
        currentResolve = res;
        currentReject = rej;
        child.stdin?.write(JSON.stringify(task) + '\n');
      });
    }

    async function startProcessing() {
      const photoResults: RunPhotoResult[] = [];
      const zeroFaceTimes: number[] = [];
      const t0Total = performance.now();

      try {
        for (const p of photos) {
          const t0 = performance.now();
          const resp = await sendTask({
            action: 'detect',
            imagePath: p.imageFullPath,
            photoId: p.id,
            conf: 0.65,
            minFaceSize: 45,
          });
          const elapsedMs = Number((performance.now() - t0).toFixed(2));
          const facesCount = resp.faces?.length || 0;

          photoResults.push({
            photoId: p.id,
            facesFound: facesCount,
            timeMs: elapsedMs,
          });

          if (facesCount === 0) {
            zeroFaceTimes.push(elapsedMs);
          }
        }

        const totalElapsedMs = Number((performance.now() - t0Total).toFixed(2));
        const pps = Number((photos.length / (totalElapsedMs / 1000)).toFixed(2));

        child.stdin?.write('QUIT\n');
        child.stdin?.end();

        resolve({
          runIndex,
          totalTimeMs: totalElapsedMs,
          photosPerSec: pps,
          photos: photoResults,
          zeroFaceTimesMs: zeroFaceTimes,
        });
      } catch (err) {
        child.kill();
        reject(err);
      }
    }
  });
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
}

async function main() {
  console.log('================================================================================');
  console.log('PART 1: NODE -> face_cli.py DAEMON THREAD SWEEP (THREADS = 1, 2, 3, 4, 6, 8)');
  console.log('================================================================================\n');

  // Load baseline photos
  const baselineData = JSON.parse(fs.readFileSync('baseline.json', 'utf-8'));
  const photoIds: string[] = baselineData.photos.map((p: any) => p.photoId);

  const dbPhotos = await prisma.photo.findMany({
    where: { id: { in: photoIds } },
    include: { asset: true },
  });

  const photoMap = new Map(dbPhotos.map((p) => [p.id, p]));
  const orderedPhotos: PhotoItem[] = photoIds.map((id) => {
    const p = photoMap.get(id)!;
    return {
      id: p.id,
      imageFullPath: path.resolve(process.cwd(), 'storage', p.asset.storageKeyOriginal),
      width: p.asset.width || 0,
      height: p.asset.height || 0,
    };
  });

  console.log(`Loaded ${orderedPhotos.length} benchmark photos from baseline.json.`);

  const threadConfigs = [1, 2, 3, 4, 6, 8];
  const allResults: ThreadSweepConfigResult[] = [];

  for (const th of threadConfigs) {
    console.log(`\n>>> Testing FACE_THREADS = ${th} (3 runs)...`);
    const runs: SingleRunResult[] = [];

    for (let r = 1; r <= 3; r++) {
      process.stdout.write(`  Run ${r}/3 ... `);
      const res = await runWorkerSession(orderedPhotos, th, r);
      runs.push(res);
      console.log(`Total: ${(res.totalTimeMs / 1000).toFixed(2)}s | Speed: ${res.photosPerSec} photos/sec | 0-face med: ${percentile(res.zeroFaceTimesMs, 50)}ms`);
    }

    // Sort runs by totalTimeMs to find median run
    const sortedRuns = [...runs].sort((a, b) => a.totalTimeMs - b.totalTimeMs);
    const medianRun = sortedRuns[1]; // middle of 3

    const allPhotoTimesSec = runs.flatMap((run) => run.photos.map((p) => p.timeMs / 1000));
    const allZeroFaceTimes = runs.flatMap((run) => run.zeroFaceTimesMs);
    const runSpeeds = runs.map((r) => r.photosPerSec);

    const stats = {
      medianSecPerPhoto: Number((percentile(allPhotoTimesSec, 50)).toFixed(2)),
      avgSecPerPhoto: Number(((allPhotoTimesSec.reduce((a, b) => a + b, 0) / allPhotoTimesSec.length)).toFixed(2)),
      minSecPerPhoto: Number(Math.min(...allPhotoTimesSec).toFixed(2)),
      maxSecPerPhoto: Number(Math.max(...allPhotoTimesSec).toFixed(2)),
      medianPhotosPerSec: percentile(runSpeeds, 50),
      minPhotosPerSec: Math.min(...runSpeeds),
      maxPhotosPerSec: Math.max(...runSpeeds),
      zeroFaceMedianMs: percentile(allZeroFaceTimes, 50),
      zeroFaceMinMs: Math.min(...allZeroFaceTimes),
      zeroFaceMaxMs: Math.max(...allZeroFaceTimes),
    };

    allResults.push({
      threads: th,
      runs,
      medianRun,
      stats,
    });
  }

  const outPath = path.resolve(process.cwd(), 'thread_sweep_node_results.json');
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\nSaved Node thread sweep results to ${outPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
