import { PrismaClient } from '@prisma/client';

async function runQuery(connectionString: string, label: string) {
  console.log(`[${label}] Connecting with: ${connectionString.replace(/:[^:@]+@/, ':***@')}...`);
  const prisma = new PrismaClient({
    datasources: {
      db: { url: connectionString },
    },
    log: ['warn', 'error'],
  });

  const t0 = Date.now();
  try {
    // 1. Fetch photos with at least 2 faces
    let photos = await prisma.photo.findMany({
      where: {
        isDeleted: false,
        faces: { some: {} },
      },
      include: {
        asset: true,
        faces: true,
        uploadReferences: true,
      },
      orderBy: {
        faces: { _count: 'desc' },
      },
      take: 20,
    });

    const elapsedMs = Date.now() - t0;
    console.log(`[${label}] Query completed in ${elapsedMs}ms! Total found with faces: ${photos.length}`);

    // If fewer than 10 with faces, fallback to general photos
    if (photos.length < 10) {
      const extraPhotos = await prisma.photo.findMany({
        where: { isDeleted: false },
        include: { asset: true, faces: true, uploadReferences: true },
        take: 15,
      });
      photos = extraPhotos;
    }

    // Filter to those with 2 or more faces, or pick top 10
    const groupPhotos = photos
      .filter((p) => p.faces.length >= 2)
      .slice(0, 10);

    const selection = groupPhotos.length >= 5 ? groupPhotos : photos.slice(0, 10);

    console.log(`\n=== Picked ${selection.length} Test Photos ===`);
    const pickedData = selection.map((p, idx) => ({
      index: idx + 1,
      photoId: p.id,
      filename: p.uploadReferences[0]?.originalFilename || 'unknown',
      faceCount: p.faces.length,
      storageKeyOriginal: p.asset.storageKeyOriginal,
      storageKeyPreview: p.asset.storageKeyPreview,
      dimensions: `${p.asset.width}x${p.asset.height}`,
    }));

    console.table(pickedData);
    return { success: true, selection: pickedData, elapsedMs };
  } catch (err: unknown) {
    const elapsedMs = Date.now() - t0;
    console.error(`[${label}] Query failed after ${elapsedMs}ms:`, (err as Error).message);
    return { success: false, error: err, elapsedMs };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const pooledUrl = process.env.DATABASE_URL;
  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;

  if (!pooledUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  // Try pooled first
  const resPooled = await runQuery(pooledUrl, 'POOLED');
  if (resPooled.success) {
    return;
  }

  // If pooled failed or timed out, try unpooled
  if (unpooledUrl) {
    console.log('\nRetrying with direct unpooled connection (DATABASE_URL_UNPOOLED)...');
    const resUnpooled = await runQuery(unpooledUrl, 'DIRECT_UNPOOLED');
    if (!resUnpooled.success) {
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error in pick-test-photos:', e);
  process.exit(1);
});
