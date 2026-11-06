import { prisma } from '../src/lib/db.ts';

async function main() {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          photos: true,
          people: true,
        },
      },
    },
  });
  console.log('Active Events in Database:');
  console.table(events);
}

main().finally(() => prisma.$disconnect());
