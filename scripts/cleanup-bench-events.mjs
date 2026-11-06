import { prisma } from '../src/lib/db.ts';

async function main() {
  const deleted = await prisma.event.deleteMany({
    where: {
      name: { startsWith: 'Bench_' },
    },
  });
  console.log(`Deleted ${deleted.count} temporary bench events.`);

  const testEvents = await prisma.event.deleteMany({
    where: {
      name: { startsWith: 'Test_' },
    },
  });
  console.log(`Deleted ${testEvents.count} temporary test events.`);

  const remaining = await prisma.event.findMany({
    select: { id: true, name: true, _count: { select: { photos: true, people: true } } },
  });
  console.log('Remaining real events:');
  console.table(remaining);
}

main().finally(() => prisma.$disconnect());
