import { prisma } from '../src/lib/db.ts';
import { scanPhotoForFaces, clusterEventFaces } from '../src/lib/faceService.ts';

async function main() {
  const eventId = 'cmw126ngc0000wdscnil5d95c';
  console.log(`Scanning faces for event ${eventId}...`);

  const photos = await prisma.photo.findMany({
    where: { eventId, isDeleted: false },
    include: { asset: true, uploadReferences: true },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${photos.length} photos in event.`);

  for (const photo of photos) {
    const filename = photo.uploadReferences[0]?.originalFilename || photo.asset.storageKeyOriginal;
    console.log(`Scanning photo: ${filename} (ID: ${photo.id})...`);
    try {
      const res = await scanPhotoForFaces(photo.id, photo.asset.storageKeyOriginal);
      console.log(`  -> Detected ${res.detectedCount} faces.`);
    } catch (err) {
      console.error(`  -> Failed to scan: ${err.message}`);
    }
  }

  console.log('\nRunning clustering on all faces...');
  const clusterRes = await clusterEventFaces(eventId, { eps: 0.50, minSamples: 2 });
  console.log('Clustering result:', JSON.stringify(clusterRes, null, 2));

  const people = await prisma.person.findMany({
    where: { eventId },
    include: { faces: true }
  });

  console.log(`\nTotal People created in DB: ${people.length}`);
  for (const p of people) {
    console.log(`  - Person "${p.name}" (ID: ${p.id}): ${p.faces.length} faces, Thumbnail: ${p.thumbnailUrl}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
