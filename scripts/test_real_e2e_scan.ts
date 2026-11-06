import { POST } from '../src/app/api/events/[eventId]/faces/scan/route';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/db';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  console.log('================================================================================');
  console.log('REAL END-TO-END CHECK: POST /api/events/[eventId]/faces/scan?force=true');
  console.log('================================================================================\n');

  // Load the 50 photo paths from the benchmark cache
  const cachePath = path.resolve(process.cwd(), 'storage', 'bench_py_data_t6.json');
  const pyData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const photoKeys = Object.keys(pyData.results);
  const rawPhotoIds = photoKeys.map((k) => k.replace(/^bench_\d+_/, ''));

  // Fetch the real assets for these 50 photos
  const realPhotos = await prisma.photo.findMany({
    where: { id: { in: rawPhotoIds }, isDeleted: false },
    include: { asset: true },
  });

  console.log(`Found ${realPhotos.length} existing photos with original assets.`);
  if (realPhotos.length === 0) {
    throw new Error('No photos found for test.');
  }

  // Create an isolated temporary event
  const testEvent = await prisma.event.create({
    data: {
      name: `Real_E2E_Test_${Date.now()}`,
      isPrivate: false,
      allowGuestView: true,
      allowGuestUpload: true,
    },
  });

  const dummyAssetData = Array.from({ length: 50 }, (_, i) => {
    const p = realPhotos[i % realPhotos.length];
    return {
      id: `e2e_asset_${Date.now()}_${i}`,
      fileHash: `e2e_hash_${Date.now()}_${i}`,
      storageKeyOriginal: p.asset.storageKeyOriginal,
      storageKeyPreview: p.asset.storageKeyPreview,
      mimeType: p.asset.mimeType,
      byteSize: p.asset.byteSize,
    };
  });

  try {
    await prisma.photoAsset.createMany({ data: dummyAssetData });

    await prisma.photo.createMany({
      data: dummyAssetData.map((a, i) => ({
        id: `e2e_photo_${Date.now()}_${i}`,
        eventId: testEvent.id,
        assetId: a.id,
      })),
    });

    console.log(`Attached 50 photos to temporary test event (ID: ${testEvent.id}).`);

    // Prepare NextRequest with force=true
    const req = new NextRequest(
      `http://localhost:3000/api/events/${testEvent.id}/faces/scan?force=true`,
      { method: 'POST' }
    );

    console.log('\n--- Calling POST /api/events/[eventId]/faces/scan?force=true ---');
    const t0 = Date.now();
    const response = await POST(req, { params: Promise.resolve({ eventId: testEvent.id }) });
    const elapsedMs = Date.now() - t0;

    const data = await response.json();
    console.log(`HTTP Status: ${response.status}`);
    console.log('Response Payload:');
    console.log(JSON.stringify(data, null, 2));

    // Verify database counts
    const dbFaces = await prisma.face.count({
      where: { photo: { eventId: testEvent.id } },
    });
    const dbPeople = await prisma.person.count({
      where: { eventId: testEvent.id },
    });

    console.log('\n================================================================================');
    console.log('END-TO-END VERIFICATION SUMMARY');
    console.log('================================================================================');
    console.log(`Total Time Elapsed:    ${(elapsedMs / 1000).toFixed(2)} s`);
    console.log(`Photos Scanned:        ${data.photosScanned}`);
    console.log(`Total Faces Detected:  ${data.totalFacesDetected} (DB Count: ${dbFaces}, Expected: 95)`);
    console.log(`Total People Created:  ${data.peopleCreated} (DB Count: ${dbPeople})`);
    console.log('================================================================================\n');

  } finally {
    console.log('Cleaning up temporary test event and records...');
    await prisma.event.delete({ where: { id: testEvent.id } }).catch(() => {});
    await prisma.photoAsset.deleteMany({
      where: { id: { in: dummyAssetData.map((d) => d.id) } },
    }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
