import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/db';

async function main() {
  const photos = await prisma.photo.findMany({
    where: { isDeleted: false },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`Found ${photos.length} photos.`);
  let allExist = true;
  for (const p of photos) {
    const fullPath = path.resolve(process.cwd(), 'storage', p.asset.storageKeyOriginal);
    const exists = fs.existsSync(fullPath);
    if (!exists) {
      console.log(`Missing file: ${fullPath}`);
      allExist = false;
    }
  }
  console.log(`All 20 files exist on disk: ${allExist}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
