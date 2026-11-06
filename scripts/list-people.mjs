import { prisma } from '../src/lib/db.ts';

async function main() {
  const people = await prisma.person.findMany({
    where: { eventId: 'cmw126ngc0000wdscnil5d95c' },
    include: {
      faces: {
        include: {
          photo: {
            include: { uploadReferences: true }
          }
        }
      }
    }
  });

  for (const p of people) {
    console.log(`\n--- Person: "${p.name}" (ID: ${p.id}) ---`);
    console.log(`Thumbnail: ${p.thumbnailUrl}`);
    console.log(`Total Faces: ${p.faces.length}`);
    for (const f of p.faces) {
      const fn = f.photo.uploadReferences[0]?.originalFilename || f.photo.id;
      console.log(`  -> Photo: ${fn}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
