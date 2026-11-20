import { prisma } from '../src/lib/db';

async function main() {
  const photos = await prisma.photo.findMany({
    where: { eventId: 'cmw3ynszk0000wd3wjj5ntc5g' },
    take: 20,
    select: { id: true, faces: { select: { id: true } } },
  });

  console.log(`Measuring DB transaction time for ${photos.length} photos...`);
  const times: number[] = [];

  for (const p of photos) {
    const t0 = performance.now();
    // Simulate what faceWorker does: update photo status
    await prisma.photo.update({
      where: { id: p.id },
      data: { faceStatus: 'DONE' },
    });
    const elapsed = performance.now() - t0;
    times.push(elapsed);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`DB write average over 20 photos: ${avg.toFixed(1)} ms/photo (min: ${Math.min(...times).toFixed(1)} ms, max: ${Math.max(...times).toFixed(1)} ms)`);
}

main().finally(() => prisma.$disconnect());
