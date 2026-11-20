import { prisma } from '../src/lib/db';

async function main() {
  const eventId = 'cmw3ynszk0000wd3wjj5ntc5g';
  const photos = await prisma.photo.findMany({
    where: { eventId, isDeleted: false },
    take: 200,
    select: { id: true },
  });

  console.log(`Fetched ${photos.length} photos for batched DB transaction benchmark.`);

  const CHUNK_SIZE = 25;
  const chunks: string[][] = [];
  for (let i = 0; i < photos.length; i += CHUNK_SIZE) {
    chunks.push(photos.slice(i, i + CHUNK_SIZE).map((p) => p.id));
  }

  console.log(`Partitioned into ${chunks.length} chunks of ~${CHUNK_SIZE} photos each.`);
  console.log(`Measuring batched transaction time...`);

  const t0_all = performance.now();
  const chunkTimes: number[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkIds = chunks[idx];
    const t0 = performance.now();

    await prisma.$transaction(
      async (tx) => {
        // 1 round-trip: Delete old faces for the chunk
        await tx.face.deleteMany({
          where: { photoId: { in: chunkIds } },
        });

        // 2 round-trip: Update photo status for the chunk
        await tx.photo.updateMany({
          where: { id: { in: chunkIds } },
          data: {
            faceStatus: 'DONE',
            faceProcessedAt: new Date(),
          },
        });
      },
      { timeout: 30000 }
    );

    const elapsed = performance.now() - t0;
    chunkTimes.push(elapsed);
    console.log(`  Chunk ${idx + 1}/${chunks.length} (${chunkIds.length} photos): ${elapsed.toFixed(1)} ms (${(elapsed / chunkIds.length).toFixed(1)} ms/photo)`);
  }

  const totalTime = performance.now() - t0_all;
  const avgPerChunk = chunkTimes.reduce((a, b) => a + b, 0) / chunkTimes.length;
  const avgPerPhoto = totalTime / photos.length;

  console.log('='.repeat(80));
  console.log(`BATCHED DB WRITE BENCHMARK RESULTS FOR ${photos.length} PHOTOS:`);
  console.log(`  Total DB Wall Time:      ${totalTime.toFixed(1)} ms (${(totalTime / 1000.0).toFixed(2)} seconds)`);
  console.log(`  Average Per Chunk (25p): ${avgPerChunk.toFixed(1)} ms`);
  console.log(`  Average Per Photo:       ${avgPerPhoto.toFixed(1)} ms / photo`);
  console.log(`  Speedup vs Per-Photo:    ~${(666.0 / avgPerPhoto).toFixed(1)}x faster!`);
  console.log('='.repeat(80));
}

main().finally(() => prisma.$disconnect());
