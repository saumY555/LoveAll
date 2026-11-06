import { prisma } from '../src/lib/db';

async function main() {
  const event = await prisma.event.findFirst({
    where: { name: { contains: 'nepal trip 2', mode: 'insensitive' } },
  });

  if (!event) {
    console.log('Event not found');
    return;
  }

  const photosCount = await prisma.photo.count({
    where: { eventId: event.id, isDeleted: false },
  });

  const facesCount = await prisma.face.count({
    where: { photo: { eventId: event.id, isDeleted: false } },
  });

  const people = await prisma.person.findMany({
    where: { eventId: event.id },
    include: { _count: { select: { faces: true } } },
  });

  console.log(`Event: ${event.name} (${event.id})`);
  console.log(`Photos: ${photosCount}`);
  console.log(`Faces: ${facesCount}`);
  console.log(`People / Clusters: ${people.length}`);
  people.forEach((p, idx) => {
    console.log(`  Person ${idx + 1}: ${p.name || 'Unnamed'} (${p._count.faces} faces)`);
  });
}

main().finally(() => prisma.$disconnect());
