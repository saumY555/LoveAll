import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { prisma } from '../src/lib/db';

const execFileAsync = promisify(execFile);

interface TimingData {
  fileReadMs: number;
  jpegDecodeMs: number;
  resizeMs: number;
  detectionMs: number;
  embeddingTotalMs: number;
  embeddingPerFaceMs: number;
  totalMs: number;
}

interface PhotoMetric {
  photoId: string;
  dimensions: { width: number; height: number };
  facesFound: number;
  timing: TimingData;
}

interface BenchmarkOutput {
  totalTimeMs: number;
  modelLoadMs: number;
  photosCount: number;
  totalFaces: number;
  photos: PhotoMetric[];
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

async function runSingleBenchmark(
  photos: Array<{ photoId: string; imagePath: string }>
): Promise<BenchmarkOutput> {
  const pythonPath = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'benchmark_runner.py');

  const child = execFile(pythonPath, [scriptPath], {
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, FACE_THREADS: process.env.FACE_THREADS || '6' },
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (d) => {
    stdout += d;
  });
  child.stderr?.on('data', (d) => {
    stderr += d;
  });

  child.stdin?.write(JSON.stringify(photos));
  child.stdin?.end();

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Benchmark runner failed with code ${code}: ${stderr}`));
    });
    child.on('error', reject);
  });

  return JSON.parse(stdout.trim()) as BenchmarkOutput;
}

async function main() {
  console.log('================================================================================');
  console.log('PHASE 2: FACE PIPELINE BENCHMARK (MEASUREMENT ONLY - NO DB WRITES)');
  console.log('================================================================================\n');

  // Parse args
  const args = process.argv.slice(2);
  let requestedCount = 50;
  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    requestedCount = parseInt(args[countIdx + 1], 10);
  }

  // 1. Fetch fixed set of photos WITHOUT writing anything to DB
  const photos = await prisma.photo.findMany({
    where: { isDeleted: false },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
    take: requestedCount,
  });

  if (photos.length === 0) {
    throw new Error('No photos found in database to benchmark.');
  }

  const benchmarkItems: Array<{ photoId: string; imagePath: string }> = [];
  for (const p of photos) {
    const fullPath = path.resolve(process.cwd(), 'storage', p.asset.storageKeyOriginal);
    if (fs.existsSync(fullPath)) {
      benchmarkItems.push({
        photoId: p.id,
        imagePath: fullPath,
      });
    }
  }

  console.log(`Loaded ${benchmarkItems.length} photos for benchmark dataset.`);
  console.log(`Model Settings: InsightFace buffalo_l, det_size=(640, 640), FACE_THREADS=${process.env.FACE_THREADS || 6}`);
  console.log(`Executing 3 runs to determine the median run...\n`);

  const runs: BenchmarkOutput[] = [];

  for (let runIndex = 1; runIndex <= 3; runIndex++) {
    console.log(`--- Starting Benchmark Run ${runIndex} of 3 ---`);
    const t0 = performance.now();
    const result = await runSingleBenchmark(benchmarkItems);
    const elapsedSec = (performance.now() - t0) / 1000;
    console.log(`  Run ${runIndex} Completed: totalTime = ${(result.totalTimeMs / 1000).toFixed(2)}s, faces = ${result.totalFaces}, speed = ${(result.photosCount / (result.totalTimeMs / 1000)).toFixed(2)} photos/sec`);
    runs.push(result);
  }

  // Pick median run by totalTimeMs
  const sortedRuns = [...runs].sort((a, b) => a.totalTimeMs - b.totalTimeMs);
  const medianRun = sortedRuns[1]; // middle run out of 3

  console.log(`\n================================================================================`);
  console.log(`MEDIAN RUN DETAILED ANALYSIS (Run Total: ${(medianRun.totalTimeMs / 1000).toFixed(2)}s)`);
  console.log(`================================================================================\n`);

  const fileReads = medianRun.photos.map((p) => p.timing.fileReadMs);
  const jpegDecodes = medianRun.photos.map((p) => p.timing.jpegDecodeMs);
  const resizes = medianRun.photos.map((p) => p.timing.resizeMs);
  const detections = medianRun.photos.map((p) => p.timing.detectionMs);
  const embedPerFaces = medianRun.photos
    .filter((p) => p.facesFound > 0)
    .map((p) => p.timing.embeddingPerFaceMs);
  const embedTotals = medianRun.photos.map((p) => p.timing.embeddingTotalMs);
  const photoTotals = medianRun.photos.map((p) => p.timing.totalMs);

  const widths = medianRun.photos.map((p) => p.dimensions.width);
  const heights = medianRun.photos.map((p) => p.dimensions.height);

  const stageStats = [
    {
      Stage: '1. File Read (Disk I/O)',
      'Median (ms)': percentile(fileReads, 50),
      'P90 (ms)': percentile(fileReads, 90),
      'Total Sum (s)': Number((fileReads.reduce((a, b) => a + b, 0) / 1000).toFixed(2)),
      '% Total': Number(
        ((fileReads.reduce((a, b) => a + b, 0) / medianRun.totalTimeMs) * 100).toFixed(1)
      ),
    },
    {
      Stage: '2. JPEG Decode (imdecode)',
      'Median (ms)': percentile(jpegDecodes, 50),
      'P90 (ms)': percentile(jpegDecodes, 90),
      'Total Sum (s)': Number((jpegDecodes.reduce((a, b) => a + b, 0) / 1000).toFixed(2)),
      '% Total': Number(
        ((jpegDecodes.reduce((a, b) => a + b, 0) / medianRun.totalTimeMs) * 100).toFixed(1)
      ),
    },
    {
      Stage: '3. Resize (Scaling)',
      'Median (ms)': percentile(resizes, 50),
      'P90 (ms)': percentile(resizes, 90),
      'Total Sum (s)': Number((resizes.reduce((a, b) => a + b, 0) / 1000).toFixed(2)),
      '% Total': Number(
        ((resizes.reduce((a, b) => a + b, 0) / medianRun.totalTimeMs) * 100).toFixed(1)
      ),
    },
    {
      Stage: '4. Detection (SCRFD 640x640)',
      'Median (ms)': percentile(detections, 50),
      'P90 (ms)': percentile(detections, 90),
      'Total Sum (s)': Number((detections.reduce((a, b) => a + b, 0) / 1000).toFixed(2)),
      '% Total': Number(
        ((detections.reduce((a, b) => a + b, 0) / medianRun.totalTimeMs) * 100).toFixed(1)
      ),
    },
    {
      Stage: '5. Embedding (ArcFace 512-d)',
      'Median (ms)': percentile(embedTotals, 50),
      'P90 (ms)': percentile(embedTotals, 90),
      'Total Sum (s)': Number((embedTotals.reduce((a, b) => a + b, 0) / 1000).toFixed(2)),
      '% Total': Number(
        ((embedTotals.reduce((a, b) => a + b, 0) / medianRun.totalTimeMs) * 100).toFixed(1)
      ),
    },
    {
      Stage: 'Pipeline Total (per photo)',
      'Median (ms)': percentile(photoTotals, 50),
      'P90 (ms)': percentile(photoTotals, 90),
      'Total Sum (s)': Number((medianRun.totalTimeMs / 1000).toFixed(2)),
      '% Total': 100.0,
    },
  ];

  console.table(stageStats);

  const photosPerSec = Number((medianRun.photosCount / (medianRun.totalTimeMs / 1000)).toFixed(2));
  const msPerPhoto = Number((medianRun.totalTimeMs / medianRun.photosCount).toFixed(1));

  console.log(`Key Summary Metrics:`);
  console.log(`- Photos Benchmarked:    ${medianRun.photosCount}`);
  console.log(`- Total Elapsed Time:    ${(medianRun.totalTimeMs / 1000).toFixed(2)} s`);
  console.log(`- Throughput:            ${photosPerSec} photos/sec (${msPerPhoto} ms/photo)`);
  console.log(`- Total Faces Detected:  ${medianRun.totalFaces} faces (avg ${(medianRun.totalFaces / medianRun.photosCount).toFixed(2)} faces/photo)`);
  console.log(`- Embedding per face:    median ${percentile(embedPerFaces, 50)} ms, p90 ${percentile(embedPerFaces, 90)} ms`);
  console.log(`- Photo Dimensions:      width [min: ${Math.min(...widths)}, median: ${percentile(widths, 50)}, max: ${Math.max(...widths)}], height [min: ${Math.min(...heights)}, median: ${percentile(heights, 50)}, max: ${Math.max(...heights)}]`);

  // Identify dominating stage
  const maxStage = stageStats
    .slice(0, 5)
    .reduce((prev, curr) => (curr['% Total'] > prev['% Total'] ? curr : prev));
  console.log(`\nDominating Stage: ${maxStage.Stage} accounting for ${maxStage['% Total']}% of pipeline time.`);

  // Save to benchmark-results.json
  const benchmarkResultsPath = path.resolve(process.cwd(), 'benchmark-results.json');
  const resultsPayload = {
    timestamp: new Date().toISOString(),
    runs: runs.map((r, i) => ({
      runIndex: i + 1,
      totalTimeMs: r.totalTimeMs,
      photosCount: r.photosCount,
      totalFaces: r.totalFaces,
      photosPerSec: Number((r.photosCount / (r.totalTimeMs / 1000)).toFixed(2)),
    })),
    medianRun: {
      totalTimeMs: medianRun.totalTimeMs,
      modelLoadMs: medianRun.modelLoadMs,
      photosCount: medianRun.photosCount,
      totalFaces: medianRun.totalFaces,
      photosPerSec,
      stageStats,
      dimensions: {
        widthMin: Math.min(...widths),
        widthMedian: percentile(widths, 50),
        widthMax: Math.max(...widths),
        heightMin: Math.min(...heights),
        heightMedian: percentile(heights, 50),
        heightMax: Math.max(...heights),
      },
      photos: medianRun.photos,
    },
  };

  fs.writeFileSync(benchmarkResultsPath, JSON.stringify(resultsPayload, null, 2), 'utf8');
  console.log(`\nSaved median run benchmark results to: ${benchmarkResultsPath}`);
  console.log('================================================================================\n');
}

main()
  .catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
