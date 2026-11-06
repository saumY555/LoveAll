import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { chunkArray } from '../src/lib/faceService';

const directCleanUrl = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '').replace('-pooler.', '.');
const prisma = new PrismaClient({
  datasources: { db: { url: directCleanUrl } },
});

async function runTests() {
  console.log('=== STEP 2 VERIFICATION TEST SUITE ===\n');

  // Create an isolated temporary test event & photo
  const testEvent = await prisma.event.create({
    data: { name: `Test_Step2_${Date.now()}` },
  });
  
  // Find a valid asset to attach a photo
  const samplePhoto = await prisma.photo.findFirst({
    where: { isDeleted: false },
    select: { assetId: true },
  });

  if (!samplePhoto) {
    throw new Error('No existing photos found to reference asset');
  }

  const testPhoto = await prisma.photo.create({
    data: {
      eventId: testEvent.id,
      assetId: samplePhoto.assetId,
    },
  });

  try {
    // -------------------------------------------------------------------------
    // TEST (A): 1,000+ Fake Faces to prove chunking at 150 and assignments at 500
    // -------------------------------------------------------------------------
    console.log('--- TEST (A): 1,200 Fake Faces Chunking Test (150 faces/chunk, 500 assignments/chunk) ---');
    const TOTAL_FACES = 1200;
    const dummyEmbedding = Array.from({ length: 512 }, () => 0.05);

    const fakeFaces = Array.from({ length: TOTAL_FACES }, (_, i) => ({
      id: crypto.randomUUID(),
      photoId: testPhoto.id,
      boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      embedding: dummyEmbedding,
      confidence: 0.95,
      thumbnailUrl: `/api/faces/fake_${i}.webp`,
      isNoise: false,
    }));

    const faceChunks = chunkArray(fakeFaces, 150);
    console.log(`Generated ${TOTAL_FACES} fake faces. Splitting into ${faceChunks.length} chunks of 150.`);

    const t_insert_start = Date.now();
    await prisma.$transaction(
      async (tx) => {
        for (let idx = 0; idx < faceChunks.length; idx++) {
          await tx.face.createMany({
            data: faceChunks[idx].map((f) => ({
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
      },
      { maxWait: 60000, timeout: 60000 }
    );
    const insertDuration = Date.now() - t_insert_start;
    const insertedCount = await prisma.face.count({ where: { photoId: testPhoto.id } });
    console.log(`[PASS] Inserted ${insertedCount}/${TOTAL_FACES} faces across ${faceChunks.length} chunks in ${insertDuration} ms.`);

    // -------------------------------------------------------------------------
    // TEST (B): Scan with Noise Faces (NULL personId, isNoise=true) & Clustered Faces
    // -------------------------------------------------------------------------
    console.log('\n--- TEST (B): Parameterized UPDATE ... FROM (VALUES ...) with Noise (NULL personId) & Clustered Faces ---');
    
    // Create 2 test persons
    const person1 = await prisma.person.create({
      data: { eventId: testEvent.id, name: 'Person A', isCover: true },
    });
    const person2 = await prisma.person.create({
      data: { eventId: testEvent.id, name: 'Person B', isCover: false },
    });

    // 1000 faces assigned to people, 200 marked as noise (personId: null, isNoise: true)
    const assignments: Array<{ faceId: string; personId: string | null; isNoise: boolean }> = [];
    for (let i = 0; i < 500; i++) {
      assignments.push({ faceId: fakeFaces[i].id, personId: person1.id, isNoise: false });
    }
    for (let i = 500; i < 1000; i++) {
      assignments.push({ faceId: fakeFaces[i].id, personId: person2.id, isNoise: false });
    }
    for (let i = 1000; i < 1200; i++) {
      assignments.push({ faceId: fakeFaces[i].id, personId: null, isNoise: true });
    }

    const assignmentChunks = chunkArray(assignments, 500);
    console.log(`Updating ${assignments.length} assignments in ${assignmentChunks.length} chunks of 500 (includes 200 noise faces).`);

    const t_assign_start = Date.now();
    await prisma.$transaction(
      async (tx) => {
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
      },
      { maxWait: 60000, timeout: 60000 }
    );
    const assignDuration = Date.now() - t_assign_start;

    // Verify DB state
    const p1Count = await prisma.face.count({ where: { personId: person1.id } });
    const p2Count = await prisma.face.count({ where: { personId: person2.id } });
    const noiseCount = await prisma.face.count({ where: { photoId: testPhoto.id, isNoise: true, personId: null } });
    console.log(`[PASS] Assignments updated in ${assignDuration} ms:`);
    console.log(`       Person 1 faces: ${p1Count} (expected: 500)`);
    console.log(`       Person 2 faces: ${p2Count} (expected: 500)`);
    console.log(`       Noise faces (NULL personId, isNoise=true): ${noiseCount} (expected: 200)`);

    if (p1Count !== 500 || p2Count !== 500 || noiseCount !== 200) {
      throw new Error('Test (B) counts do not match expected!');
    }

    // -------------------------------------------------------------------------
    // TEST (C): Rollback Test (Force an error after delete; verify old faces survive)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST (C): Rollback Test (Forced Error after deleteMany) ---');
    // First, verify we have 1,200 faces currently in the photo
    const beforeCount = await prisma.face.count({ where: { photoId: testPhoto.id } });
    console.log(`Face count before failed transaction: ${beforeCount}`);

    let caughtError = false;
    try {
      await prisma.$transaction(
        async (tx) => {
          // Step 1: Delete old faces
          const delRes = await tx.face.deleteMany({
            where: { photoId: testPhoto.id },
          });
          console.log(`Inside transaction: deleted ${delRes.count} faces.`);

          // Step 2: Force an intentional error to simulate a runtime/clustering failure
          throw new Error('FORCED_SIMULATED_FAILURE_AFTER_DELETE');
        },
        { maxWait: 60000, timeout: 60000 }
      );
    } catch (err: any) {
      if (err.message === 'FORCED_SIMULATED_FAILURE_AFTER_DELETE') {
        caughtError = true;
        console.log(`Successfully intercepted forced transaction failure: "${err.message}"`);
      } else {
        throw err;
      }
    }

    if (!caughtError) {
      throw new Error('Transaction unexpectedly did not throw!');
    }

    // Check count after rollback
    const afterCount = await prisma.face.count({ where: { photoId: testPhoto.id } });
    console.log(`Face count after rolled-back transaction: ${afterCount}`);
    if (afterCount === beforeCount && beforeCount === 1200) {
      console.log('[PASS] Rollback SUCCESSFUL: all 1,200 faces survived intact! No data lost.');
    } else {
      throw new Error(`[FAIL] Rollback failed! Expected ${beforeCount} faces but found ${afterCount}`);
    }

    console.log('\n================================================================================');
    console.log('ALL STEP 2 TESTS PASSED PERFECTLY!');
    console.log('================================================================================\n');
  } finally {
    // Cleanup temporary event (cascades to testPhoto, fake faces, persons)
    console.log('Cleaning up temporary test event and records...');
    await prisma.event.delete({ where: { id: testEvent.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

runTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
