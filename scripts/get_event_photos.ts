import { prisma } from '../src/lib/db';

async function main() {
  const p1 = await prisma.photo.findMany({
    where: { isDeleted: false },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  console.log('p1 (global desc):', p1.map(p => p.id));

  const p2 = await prisma.photo.findMany({
    where: { eventId: 'cmw1yvai90000wdwogvbw9xka', isDeleted: false },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  console.log('p2 (event desc):', p2.map(p => p.id));

  // Check if p1 and p2 are identical
  const match = p1.every((p, i) => p.id === p2[i]?.id);
  console.log('Are p1 and p2 identical?:', match);
}

main().catch(console.error).finally(() => prisma.$disconnect());
