import { POST } from '../src/app/api/events/[eventId]/faces/scan/route';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/db';

async function main() {
  const eventIdArg = process.argv[2];
  let targetEvent: { id: string; name: string } | null = null;

  if (eventIdArg) {
    targetEvent = await prisma.event.findUnique({
      where: { id: eventIdArg },
      select: { id: true, name: true },
    });
    if (!targetEvent) {
      throw new Error(`Event with ID "${eventIdArg}" not found.`);
    }
  } else {
    // Pick the event with the most photos or most recent
    const latestEvent = await prisma.event.findFirst({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, _count: { select: { photos: true } } },
    });
    if (!latestEvent) throw new Error('No events found in database.');
    targetEvent = latestEvent;
    console.log(`Defaulting to most recent event: "${latestEvent.name}" (ID: ${latestEvent.id}, Photos: ${latestEvent._count.photos})`);
  }

  console.log(`\n================================================================================`);
  console.log(`RUNNING FORCED FACE SCAN ON: "${targetEvent.name}" (${targetEvent.id})`);
  console.log(`================================================================================\n`);

  const req = new NextRequest(
    `http://localhost:3000/api/events/${targetEvent.id}/faces/scan?force=true`,
    { method: 'POST' }
  );

  const t0 = Date.now();
  const res = await POST(req, { params: Promise.resolve({ eventId: targetEvent.id }) });
  const data = await res.json();
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(2);

  console.log(`HTTP Status: ${res.status}`);
  console.log('Scan Output:');
  console.log(JSON.stringify(data, null, 2));

  // Verify DB state
  const totalFaces = await prisma.face.count({
    where: { photo: { eventId: targetEvent.id, isDeleted: false } },
  });
  const totalPeople = await prisma.person.count({
    where: { eventId: targetEvent.id },
  });

  console.log('\n================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================');
  console.log(`Total Time Elapsed:    ${elapsedSec} s`);
  console.log(`Photos Scanned:        ${data.photosScanned ?? 'N/A'}`);
  console.log(`Faces Detected:        ${data.totalFacesDetected ?? 'N/A'} (In DB: ${totalFaces})`);
  console.log(`People Created:        ${data.peopleCreated ?? 'N/A'} (Total People in DB: ${totalPeople})`);
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('Forced scan failed:', err);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
