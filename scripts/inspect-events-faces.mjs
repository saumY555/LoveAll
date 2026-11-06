import { prisma } from '../src/lib/db.ts';

async function main() {
  const events = await prisma.event.findMany({
    include: {
      _count: {
        select: {
          photos: true,
          people: true,
        },
      },
    },
  });

  for (const e of events) {
    const faceCount = await prisma.face.count({
      where: { photo: { eventId: e.id, isDeleted: false } },
    });
    console.log(`Event "${e.name}" (ID: ${e.id}):`);
    console.log(`  Photos: ${e._count.photos}, People: ${e._count.people}, Faces in DB: ${faceCount}`);
  }
}

main().finally(() => prisma.$disconnect());
