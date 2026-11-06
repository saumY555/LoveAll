import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

function getPrisma(url: string) {
  return new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
}

async function main() {
  const directCleanUrl = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '').replace('-pooler.', '.');
  let prisma = getPrisma(directCleanUrl);
  let photos: any[] = [];

  try {
    photos = await prisma.photo.findMany({
      where: { isDeleted: false },
      include: { asset: true },
      take: 50,
    });
  } catch (e: any) {
    console.warn(`[DIRECT] connection attempt failed (${e.message}). Retrying once...`);
    await new Promise((r) => setTimeout(r, 1000));
    photos = await prisma.photo.findMany({
      where: { isDeleted: false },
      include: { asset: true },
      take: 50,
    });
  }

  console.log(`Fetched ${photos.length} photos.`);
  if (photos.length === 0) {
    throw new Error('No photos found in database');
  }

  const photos50 = Array.from({ length: 50 }, (_, i) => {
    const p = photos[i % photos.length];
    return {
      photoId: `bench_${i}_${p.id}`,
      imagePath: path.resolve(process.cwd(), 'storage', p.asset.storageKeyOriginal),
    };
  });

  const pythonScript = path.resolve(process.cwd(), 'scripts', 'profile_stages.py');
  const pythonPath = process.env.PYTHON_PATH || 'C:\\Users\\LENOVO\\AppData\\Local\\Python\\bin\\python.exe';

  const threads = process.env.FACE_THREADS || '6';
  const cachePath = path.resolve(process.cwd(), 'storage', `bench_py_data_t${threads}.json`);
  let pyData: any;

  if (fs.existsSync(cachePath)) {
    console.log(`Using cached Python profile results from ${cachePath}`);
    pyData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } else {
    console.log(`Running instrumented Python profile on 50 photos with FACE_THREADS=${threads}...`);
    const child = execFile(
      pythonPath,
      [pythonScript],
      {
        maxBuffer: 50 * 1024 * 1024,
        env: { ...process.env, FACE_THREADS: threads },
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => {
      stderr += d;
      process.stderr.write(d);
    });

    child.stdin?.write(JSON.stringify(photos50));
    child.stdin?.end();

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Python exited with code ${code}: ${stderr}`));
      });
      child.on('error', reject);
    });

    pyData = JSON.parse(stdout.trim());
    fs.writeFileSync(cachePath, JSON.stringify(pyData, null, 2));
  }

  const timings = pyData.timings;
  const results = pyData.results;

  console.log('\n--- Measuring Node / Prisma Database Operations ---');
  await prisma.$disconnect().catch(() => {});
  prisma = getPrisma(directCleanUrl);
  await prisma.$connect();

  let dbQueriesCount = 0;
  const t_db_start = Date.now();

  // Create a temporary benchmark event & photo to avoid unique constraint and foreign key violations
  const benchEvent = await prisma.event.create({
    data: { name: 'Benchmark Temporary' },
  });
  const benchPhoto = await prisma.photo.create({
    data: {
      eventId: benchEvent.id,
      assetId: photos[0].assetId,
    },
  });
  dbQueriesCount += 2;

  try {
    for (let i = 0; i < 50; i++) {
      const item = photos50[i];
      const faces = results[item.photoId]?.faces || [];

      // 1. deleteMany query
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await prisma.face.deleteMany({ where: { photoId: benchPhoto.id } });
          break;
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      dbQueriesCount++;

      // 2. createMany query
      if (faces.length > 0) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await prisma.face.createMany({
              data: faces.map((f: any) => ({
                photoId: benchPhoto.id,
                boundingBox: f.boundingBox,
                embedding: f.embedding,
                confidence: f.confidence,
                thumbnailUrl: `/api/faces/${f.thumbnailFilename}`,
                isNoise: false,
              })),
            });
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        dbQueriesCount++;
      }
    }
  } finally {
    // Clean up temporary benchmark event (cascades to photo and faces)
    await prisma.event.delete({ where: { id: benchEvent.id } }).catch(() => {});
    dbQueriesCount++;
  }

  const dbTotalMs = Date.now() - t_db_start;

  let totalFacesFound = 0;
  for (const r of Object.values(results) as any[]) {
    if (r.faces) totalFacesFound += r.faces.length;
  }

  // Count clusters from Agglomerative clustering
  const allEmbeddings: number[][] = [];
  for (const r of Object.values(results) as any[]) {
    if (r.faces) {
      for (const f of r.faces) {
        allEmbeddings.push(f.embedding);
      }
    }
  }

  const totalFaces = pyData.total_faces ?? totalFacesFound;
  const peopleCount = pyData.people_count ?? 0;

  console.log('\n================================================================================');
  console.log(`MEASURED TIME PER STAGE FOR 50 PHOTOS (FACE_THREADS = ${threads})`);
  console.log('================================================================================');
  console.log(`Faces Found:                         ${totalFaces}`);
  console.log(`People Found:                        ${peopleCount}`);
  console.log(`Python Startup + Model Load:         ${(timings.model_load_ms / 1000).toFixed(3)} s`);
  console.log(`Image Decode (OpenCV imread):        ${(timings.image_decode_ms / 1000).toFixed(3)} s (avg: ${(timings.image_decode_ms / 50).toFixed(1)} ms/photo)`);
  console.log(`Face Detection (Scrfd ONNX):         ${(timings.detection_ms / 1000).toFixed(3)} s (avg: ${(timings.detection_ms / 50).toFixed(1)} ms/photo)`);
  console.log(`Feature Embedding (ArcFace ONNX):    ${(timings.embedding_ms / 1000).toFixed(3)} s (avg: ${(timings.embedding_ms / 50).toFixed(1)} ms/photo, ${(timings.embedding_ms / (totalFacesFound || 1)).toFixed(1)} ms/face)`);
  console.log(`Face Crop Saving (160px WebP):       ${(timings.crop_save_ms / 1000).toFixed(3)} s (avg: ${(timings.crop_save_ms / 50).toFixed(1)} ms/photo)`);
  console.log(`Result Transfer back to Node:        ${(timings.transfer_ms / 1000).toFixed(3)} s`);
  console.log(`Clustering Time (Agglomerative):     ${(timings.clustering_ms / 1000).toFixed(3)} s`);
  console.log(`Prisma DB Writes to Neon:            ${(dbTotalMs / 1000).toFixed(3)} s (${dbQueriesCount} queries, avg: ${(dbTotalMs / dbQueriesCount).toFixed(1)} ms/query)`);
  console.log('--------------------------------------------------------------------------------');
  const grandTotalMs = timings.model_load_ms + timings.image_decode_ms + timings.detection_ms + timings.embedding_ms + timings.crop_save_ms + timings.transfer_ms + timings.clustering_ms + dbTotalMs;
  console.log(`TOTAL PIPELINE TIME (50 PHOTOS):     ${(grandTotalMs / 1000).toFixed(2)} s (~${((grandTotalMs / 1000) / 60).toFixed(2)} minutes)`);
  console.log(`PROJECTED TIME FOR 200 PHOTOS:       ${((grandTotalMs * 4) / 1000 / 60).toFixed(2)} minutes`);
  console.log('================================================================================\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Measurement failed:', e);
  process.exit(1);
});
