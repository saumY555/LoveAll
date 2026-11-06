import { prisma } from '../src/lib/db';

async function main() {
  const event = await prisma.event.findFirst({
    where: { name: { contains: 'nepal trip 2', mode: 'insensitive' } },
    include: { people: { select: { id: true, name: true } } },
  });
  if (!event) return;

  const people = event.people;
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const p1 = people[i].id;
      const p2 = people[j].id;
      const shared = await prisma.photo.count({
        where: {
          eventId: event.id,
          isDeleted: false,
          AND: [
            { faces: { some: { personId: p1 } } },
            { faces: { some: { personId: p2 } } },
          ],
        },
      });
      if (shared === 0) {
        console.log(`Within nepal trip 2, zero shared photos: ${people[i].name} (${p1}) and ${people[j].name} (${p2})`);
        return;
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
