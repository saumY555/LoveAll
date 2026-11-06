import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const photos = await prisma.photo.findMany({
    where: { isDeleted: false },
    include: {
      uploadReferences: true,
      faces: true,
      asset: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Total photos:', photos.length);
  for (const p of photos) {
    console.log(`\nPhoto ID: ${p.id} | Filename: ${p.uploadReferences[0]?.originalFilename} | Asset: ${p.asset.storageKeyOriginal} | ${p.asset.width}x${p.asset.height} | Faces: ${p.faces.length}`);
    for (const f of p.faces) {
      console.log(`  Face ID: ${f.id} | PersonId: ${f.personId} | Conf: ${f.confidence} | BBox: ${JSON.stringify(f.boundingBox)} | isNoise: ${f.isNoise}`);
    }
  }

  const people = await prisma.person.findMany({ include: { faces: true } });
  console.log('\n--- Discovered People in DB ---');
  for (const pers of people) {
    console.log(`Person ${pers.id}: "${pers.name}" -> ${pers.faces.length} faces (${pers.faces.map(f => f.id).join(', ')})`);
  }
}

main().finally(() => prisma.$disconnect());
