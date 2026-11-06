import { prisma } from '../src/lib/db';

async function main() {
  const photos = await prisma.photo.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      asset: {
        select: {
          storageKeyOriginal: true,
          width: true,
          height: true,
        },
      },
      _count: { select: { faces: true } },
    },
    orderBy: { faces: { _count: 'desc' } },
    take: 10,
  });

  console.log('Top photos by face count in DB:');
  for (const p of photos) {
    console.log(`id: ${p.id}, faces: ${p._count.faces}, dims: ${p.asset.width}x${p.asset.height}, path: ${p.asset.storageKeyOriginal}`);
  }
}

main().finally(() => prisma.$disconnect());
