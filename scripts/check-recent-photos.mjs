import { prisma } from '../src/lib/db.ts';

async function main() {
  const photos = await prisma.photo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      eventId: true,
      event: { select: { name: true } },
      createdAt: true,
      uploadReferences: {
        select: { originalFilename: true, uploadedAt: true },
      },
    },
  });

  console.log(`Found ${photos.length} recent photos:`);
  for (const p of photos) {
    const fn = p.uploadReferences[0]?.originalFilename || 'unnamed';
    console.log(`[${p.createdAt.toISOString()}] Event: "${p.event.name}" (${p.eventId}) - ${fn} (ID: ${p.id})`);
  }

  const events = await prisma.event.findMany({
    include: { _count: { select: { photos: true, people: true } } },
  });
  console.log('\nAll events:');
  console.table(events.map(e => ({ id: e.id, name: e.name, photos: e._count.photos, people: e._count.people })));
}

main().finally(() => prisma.$disconnect());
