import { prisma } from '../src/lib/db';
import { FaceStatus } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const pendingPhotos = await prisma.photo.findMany({
    where: { faceStatus: FaceStatus.PENDING, isDeleted: false },
    include: { asset: true },
  });

  console.log(`Total pending photos: ${pendingPhotos.length}`);

  let missingCount = 0;
  for (const p of pendingPhotos) {
    const fullPath = path.resolve(process.cwd(), 'storage', p.asset.storageKeyOriginal);
    if (!fs.existsSync(fullPath)) {
      missingCount++;
      console.log(`Missing file for photo ${p.id}: ${fullPath}`);
    }
  }

  console.log(`Missing files: ${missingCount}`);
  if (missingCount === 0) {
    console.log('All 68 pending photo files exist in storage!');
  }
}

main().finally(() => prisma.$disconnect());
