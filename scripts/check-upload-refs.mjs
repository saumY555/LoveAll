import { prisma } from '../src/lib/db.ts';

async function main() {
  const eventId = 'cmw1yvai90000wdwogvbw9xka';
  const refs = await prisma.photoUploadReference.findMany({
    where: { photo: { eventId } },
    select: { id: true, originalFilename: true, uploadedAt: true, photoId: true },
  });
  console.log(`Total upload references for nepal trip 2: ${refs.length}`);
  for (const r of refs) {
    console.log(`- ${r.originalFilename} (photoId: ${r.photoId})`);
  }
}

main().finally(() => prisma.$disconnect());
