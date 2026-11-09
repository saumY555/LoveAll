import { prisma } from '../src/lib/db';

async function main() {
  const counts = await prisma.photo.groupBy({
    by: ['faceStatus'],
    _count: { _all: true },
  });
  console.log('Photo status counts:');
  for (const c of counts) {
    console.log(`  ${c.faceStatus}: ${c._count._all}`);
  }

  const total = await prisma.photo.count({ where: { isDeleted: false } });
  console.log('Total non-deleted photos:', total);

  // Reset all FAILED photos back to PENDING so the worker picks them up
  const reset = await prisma.photo.updateMany({
    where: { faceStatus: 'FAILED', isDeleted: false },
    data: { faceStatus: 'PENDING', faceError: null },
  });
  console.log(`Reset ${reset.count} FAILED photos -> PENDING`);

  // Also reset any stuck PROCESSING photos
  const resetProcessing = await prisma.photo.updateMany({
    where: { faceStatus: 'PROCESSING', isDeleted: false },
    data: { faceStatus: 'PENDING', faceError: null },
  });
  console.log(`Reset ${resetProcessing.count} PROCESSING photos -> PENDING`);

  await prisma.$disconnect();
}

main().catch(console.error);
