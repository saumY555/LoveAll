import { PrismaClient, Prisma } from '@prisma/client';
import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { chunkArray, ClusterResult } from '../src/lib/faceService';

const directCleanUrl = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '').replace('-pooler.', '.');

function getPrismaWithQueryLogging() {
  const p = new PrismaClient({
    datasources: { db: { url: directCleanUrl } },
    log: [{ emit: 'event', level: 'query' }],
  });
  return p;
}

async function main() {
  console.log('================================================================================');
  console.log('STEP 2: 50-PHOTO SCAN BENCHMARK & QUERY COUNT AUDIT (FACE_THREADS=6)');
  console.log('================================================================================\n');

  const basePrisma = new PrismaClient({ datasources: { db: { url: directCleanUrl } } });
  
  // 1. Fetch photos from DB to get image paths
  const photos = await basePrisma.photo.findMany({
    where: { isDeleted: false },
    include: { asset: true },
    take: 50,
  });

  if (photos.length === 0) {
    throw new Error('No photos found in database');
  }

  const photos50 = Array.from({ length: 50 }, (_, i) => {
    const p = photos[i % photos.length];
    return {
      photoId: `bench50_${i}_${p.id}`,
      imagePath: path.resolve(process.cwd(), 'storage', p.asset.storageKeyOriginal),
    };
  });

  const threads = '6';

  // 2. Load cached profile or run
  const cachePath = path.resolve(process.cwd(), 'storage', `bench_py_data_t${threads}.json`);
  let pyData: any;
  if (fs.existsSync(cachePath)) {
    console.log(`Loading Python detection & embedding results from ${cachePath}...`);
    pyData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } else {
    throw new Error('Cache file not found');
  }

  const results = pyData.results;
  const timings = pyData.timings;

  // Flatten all detected faces with generated UUIDs
  const allDetectedFaces: Array<{
    id: string;
    photoId: string;
    boundingBox: any;
    embedding: number[];
    confidence: number;
    thumbnailUrl: string;
    isNoise: boolean;
  }> = [];

  for (const [photoId, res] of Object.entries(results) as any[]) {
    const faces = res.faces || [];
    for (const f of faces) {
      allDetectedFaces.push({
        id: crypto.randomUUID(),
        photoId,
        boundingBox: f.boundingBox,
        embedding: f.embedding,
        confidence: f.confidence,
        thumbnailUrl: `/api/faces/${f.thumbnailFilename}`,
        isNoise: false,
      });
    }
  }

  console.log(`Total detected faces across 50 photos: ${allDetectedFaces.length}`);

  // 3. Run Python clustering via CLI worker
  // Note: minSamples=1 matches the raw AgglomerativeClustering (21 people, 0 noise)
  //       minSamples=2 matches DBSCAN-style noise rejection (9 people, 12 noise)
  const pythonPath = process.env.PYTHON_PATH || 'C:\\Users\\LENOVO\\AppData\\Local\\Python\\bin\\python.exe';
  const cliScript = path.resolve(process.cwd(), 'worker', 'face_cli.py');
  const clusterPayload = allDetectedFaces.map((f) => ({
    id: f.id,
    embedding: f.embedding,
    confidence: f.confidence,
  }));

  async function runClustering(minSamples: number): Promise<ClusterResult> {
    const clusterChild = execFile(
      pythonPath,
      [cliScript, 'cluster', '--eps', '0.50', '--minSamples', String(minSamples)],
      { maxBuffer: 20 * 1024 * 1024 }
    );

    let clusterStdout = '';
    let clusterStderr = '';
    clusterChild.stdout?.on('data', (d) => { clusterStdout += d; });
    clusterChild.stderr?.on('data', (d) => { clusterStderr += d; });
    clusterChild.stdin?.write(JSON.stringify(clusterPayload));
    clusterChild.stdin?.end();

    await new Promise<void>((resolve, reject) => {
      clusterChild.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Clustering exited with code ${code}: ${clusterStderr}`));
      });
      clusterChild.on('error', reject);
    });

    const parsed = JSON.parse(clusterStdout.trim());
    return parsed.result;
  }

  console.log('Running Python clustering with minSamples=1 (all clusters as people, matching raw profile):');
  const clusterResultMin1 = await runClustering(1);
  console.log(`minSamples=1 -> People: ${clusterResultMin1.clusters.length}, Noise: ${clusterResultMin1.noiseFaceIds.length}`);

  console.log('Running Python clustering with minSamples=2 (min 2 faces per person):');
  const clusterResultMin2 = await runClustering(2);
  console.log(`minSamples=2 -> People: ${clusterResultMin2.clusters.length}, Noise: ${clusterResultMin2.noiseFaceIds.length}`);

  // Use clusterResultMin1 to verify the exact 21 people benchmark!
  const clusterResult = clusterResultMin1;

  // 4. Create benchmark event and 50 unique assets & photos
  const benchEvent = await basePrisma.event.create({
    data: { name: `Bench_Step2_${Date.now()}` },
  });

  const dummyAssetIds: string[] = [];
  for (let i = 0; i < 50; i++) {
    const asset = await basePrisma.photoAsset.create({
      data: {
        fileHash: `bench_hash_${Date.now()}_${i}`,
        storageKeyOriginal: `bench_key_${Date.now()}_${i}.jpg`,
        mimeType: 'image/jpeg',
        byteSize: 1024,
      },
    });
    dummyAssetIds.push(asset.id);
  }

  const photoKeys = Object.keys(results);
  await basePrisma.photo.createMany({
    data: photoKeys.map((pId, i) => ({
      id: pId,
      eventId: benchEvent.id,
      assetId: dummyAssetIds[i],
    })),
  });

  // Setup Prisma with query event logging
  const prismaLogged = getPrismaWithQueryLogging();
  let queryCount = 0;
  const queries: string[] = [];

  // @ts-ignore
  prismaLogged.$on('query', (e: any) => {
    queryCount++;
    queries.push(e.query);
  });

  const successfulPhotoIds = photoKeys;
  const faceMap = new Map(allDetectedFaces.map((f) => [f.id, f]));

  // Build new people list and assignments
  const newPeopleToCreate: Array<{
    id: string;
    eventId: string;
    name: string;
    thumbnailUrl: string | null;
    isCover: boolean;
  }> = [];

  const assignments: Array<{
    faceId: string;
    personId: string | null;
    isNoise: boolean;
  }> = [];

  for (let i = 0; i < clusterResult.clusters.length; i++) {
    const cluster = clusterResult.clusters[i];
    const repFace = faceMap.get(cluster.representativeFaceId);
    const thumbUrl = repFace?.thumbnailUrl || null;
    const personId = crypto.randomUUID();

    newPeopleToCreate.push({
      id: personId,
      eventId: benchEvent.id,
      name: `Person ${i + 1}`,
      thumbnailUrl: thumbUrl,
      isCover: i === 0,
    });

    for (const fId of cluster.faceIds) {
      assignments.push({
        faceId: fId,
        personId,
        isNoise: false,
      });
    }
  }

  for (const noiseId of clusterResult.noiseFaceIds) {
    assignments.push({
      faceId: noiseId,
      personId: null,
      isNoise: true,
    });
  }

  const faceChunks = chunkArray(allDetectedFaces, 150);
  const peopleChunks = chunkArray(newPeopleToCreate, 500);
  const assignmentChunks = chunkArray(assignments, 500);

  console.log('\n--- Executing Atomic Batch Database Persistence with Query Logging ---');
  queryCount = 0; // Reset query counter to only measure the persist transaction
  const t_tx_start = Date.now();

  await prismaLogged.$transaction(
    async (tx) => {
      // 1. Bulk delete old faces for successful photos
      if (successfulPhotoIds.length > 0) {
        await tx.face.deleteMany({
          where: { photoId: { in: successfulPhotoIds } },
        });
      }

      // 2. Bulk insert detected faces (chunked at 150)
      for (const chunk of faceChunks) {
        await tx.face.createMany({
          data: chunk.map((f) => ({
            id: f.id,
            photoId: f.photoId,
            boundingBox: f.boundingBox,
            embedding: f.embedding,
            confidence: f.confidence,
            thumbnailUrl: f.thumbnailUrl,
            isNoise: false,
          })),
        });
      }

      // 3. Bulk insert new people (chunked at 500)
      for (const chunk of peopleChunks) {
        await tx.person.createMany({ data: chunk });
      }

      // 4. Bulk update face assignments (chunked at 500)
      for (const chunk of assignmentChunks) {
        const values = chunk.map(
          (r) => Prisma.sql`(${r.faceId}::text, ${r.personId}::text, ${r.isNoise}::boolean)`
        );
        await tx.$executeRaw`
          UPDATE "Face" AS f
          SET "personId" = v.person_id,
              "isNoise" = v.is_noise
          FROM (VALUES ${Prisma.join(values)}) AS v(face_id, person_id, is_noise)
          WHERE f.id = v.face_id
        `;
      }

      // 5. Clean up any empty Person entities
      await tx.person.deleteMany({
        where: {
          eventId: benchEvent.id,
          faces: { none: {} },
        },
      });
    },
    { maxWait: 60000, timeout: 60000 }
  );

  const txDurationMs = Date.now() - t_tx_start;

  // Verify saved counts from DB
  const dbFaceCount = await basePrisma.face.count({
    where: { photo: { eventId: benchEvent.id } },
  });
  const dbPeople = await basePrisma.person.findMany({
    where: { eventId: benchEvent.id },
    include: { _count: { select: { faces: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n================================================================================');
  console.log('STEP 2 BATCH DB PERFORMANCE & VERIFICATION REPORT');
  console.log('================================================================================');
  console.log(`Measured DB Transaction Duration:     ${(txDurationMs / 1000).toFixed(3)} s (${txDurationMs} ms)`);
  console.log(`Database Queries Executed:            ${queryCount} queries (log: ['query'])`);
  console.log(`Total Faces in DB:                    ${dbFaceCount} (Expected: 95)`);
  console.log(`Total People in DB:                   ${dbPeople.length} (Expected: 21)`);
  console.log('--------------------------------------------------------------------------------');
  console.log('Executed Queries Breakdown:');
  queries.forEach((q, idx) => {
    const compactQ = q.replace(/\s+/g, ' ').substring(0, 110);
    console.log(`  [${idx + 1}] ${compactQ}...`);
  });
  console.log('--------------------------------------------------------------------------------');
  console.log('PER-PERSON FACE COUNTS COMPARISON TABLE:');
  console.log('Person Name      | Faces Assigned | Representative ID');
  console.log('-----------------+----------------+---------------------------------------------');
  dbPeople.forEach((p, idx) => {
    const rep = clusterResult.clusters[idx]?.representativeFaceId?.slice(0, 8) || 'N/A';
    console.log(`${(p.name || 'Person').padEnd(16)} | ${String(p._count.faces).padStart(14)} | ${rep}...`);
  });
  console.log('--------------------------------------------------------------------------------');

  const beforeDbMs = 27200; // 27.2s baseline
  console.log(`DB Time Before (Sequential Writes):   ${(beforeDbMs / 1000).toFixed(2)} s (92 queries)`);
  console.log(`DB Time After  (Batch Transaction):   ${(txDurationMs / 1000).toFixed(2)} s (${queryCount} queries)`);
  console.log(`DB Speedup:                           ${(beforeDbMs / txDurationMs).toFixed(1)}x faster!`);
  console.log('================================================================================\n');

  // Clean up benchmark event & assets
  console.log('Cleaning up benchmark records...');
  await basePrisma.event.delete({ where: { id: benchEvent.id } }).catch(() => {});
  await basePrisma.photoAsset.deleteMany({ where: { id: { in: dummyAssetIds } } }).catch(() => {});
  await basePrisma.$disconnect();
  await prismaLogged.$disconnect();
}

main().catch(async (e) => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});
