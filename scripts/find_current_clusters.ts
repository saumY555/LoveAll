import { prisma } from '../src/lib/db';

async function main() {
  const eventId = 'cmw3ynszk0000wd3wjj5ntc5g';

  const people = await prisma.person.findMany({
    where: { eventId },
    include: {
      faces: {
        select: { id: true, photoId: true, confidence: true, boxWidth: true, boxHeight: true, brightness: true, blurScore: true, thumbnailUrl: true },
      },
    },
    orderBy: { faces: { _count: 'desc' } },
  });

  console.log(`Total people in event: ${people.length}`);
  console.log('Top 10 people by face count:');
  for (let i = 0; i < Math.min(10, people.length); i++) {
    const p = people[i];
    const pids = new Set(p.faces.map((f) => f.photoId));
    console.log(`  #${i + 1} "${p.name}" (ID: ${p.id}): ${p.faces.length} faces across ${pids.size} photos`);
  }

  // Find where faces from P9 & P15 photos went
  const p9_photo = 'cmw3ysirk00gqwd3wbx75y980';
  const p15_photos = [
    'cmw3ysg0k00g6wd3wpw5jna2y',
    'cmw3ysh2600gewd3w1z07jahv',
    'cmw3ysgbp00g8wd3wst0ibygk',
  ];

  console.log('\n--- Checking Person 9 photo faces ---');
  const p9Faces = await prisma.face.findMany({
    where: { photoId: p9_photo },
    include: { person: true },
  });
  console.log(`Faces in P9 photo (${p9_photo}): ${p9Faces.length}`);
  for (const f of p9Faces) {
    console.log(`  Face ${f.id.slice(0, 8)}: person "${f.person?.name}" (${f.personId}) | box ${f.boxWidth}x${f.boxHeight} | conf ${f.confidence.toFixed(2)}`);
  }

  console.log('\n--- Checking Person 15 photo faces ---');
  const p15Faces = await prisma.face.findMany({
    where: { photoId: { in: p15_photos } },
    include: { person: true },
  });
  console.log(`Faces in P15 photos: ${p15Faces.length}`);
  for (const f of p15Faces) {
    console.log(`  Face ${f.id.slice(0, 8)} (photo ${f.photoId.slice(0, 10)}): person "${f.person?.name}" (${f.personId}) | box ${f.boxWidth}x${f.boxHeight} | conf ${f.confidence.toFixed(2)}`);
  }
}

main().finally(() => prisma.$disconnect());
