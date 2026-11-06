import { prisma } from '../src/lib/db';
import { FaceStatus } from '@prisma/client';

async function main() {
  const event = await prisma.event.findFirst({
    where: { name: { contains: 'nepal trip 2', mode: 'insensitive' } },
  });

  if (!event) {
    console.log('No event found');
    return;
  }

  const counts = await prisma.photo.groupBy({
    by: ['faceStatus'],
    where: { eventId: event.id, isDeleted: false },
    _count: { id: true },
  });
  console.log('Event photo counts by status:', counts);

  const processing = await prisma.photo.findMany({
    where: { eventId: event.id, faceStatus: FaceStatus.PROCESSING, isDeleted: false },
    select: { id: true, faceProcessedAt: true },
  });
  console.log('Processing photos count:', processing.length);

  const pending = await prisma.photo.findMany({
    where: { eventId: event.id, faceStatus: FaceStatus.PENDING, isDeleted: false },
    select: { id: true, createdAt: true },
  });
  console.log('Pending photos count:', pending.length);
}

main().finally(() => prisma.$disconnect());
