import { prisma } from '../src/lib/db';

async function main() {
  const eventId = 'cmw3ynszk0000wd3wjj5ntc5g';

  // 1. Fetch Big Clusters by ID:
  const p13Id = '523f122d-a745-4afa-82e2-94297b9cb062';
  const p7Id = '95474eb6-6145-403c-babd-916c9dc47c64';
  const p1Id = '3c1155a0-caab-48a9-b672-3d418373487c';
  const p16Id = '187385e1-0941-405c-9f85-c660274fd839';
  const p5Id = 'bdeb2dec-a32f-4efc-b767-b1593d78fb82';

  const [p13, p7, p1, p16, p5] = await Promise.all([
    prisma.person.findUnique({ where: { id: p13Id }, include: { faces: true } }),
    prisma.person.findUnique({ where: { id: p7Id }, include: { faces: true } }),
    prisma.person.findUnique({ where: { id: p1Id }, include: { faces: true } }),
    prisma.person.findUnique({ where: { id: p16Id }, include: { faces: true } }),
    prisma.person.findUnique({ where: { id: p5Id }, include: { faces: true } }),
  ]);

  console.log(`Person 13: ${p13?.name} (${p13?.faces.length} faces)`);
  console.log(`Person 7:  ${p7?.name} (${p7?.faces.length} faces)`);
  console.log(`Person 16: ${p16?.name} (${p16?.faces.length} faces)`);
  console.log(`Person 1:  ${p1?.name} (${p1?.faces.length} faces)`);
  console.log(`Person 5:  ${p5?.name} (${p5?.faces.length} faces)`);

  // Target photos for Person 9 and Person 15
  const p9_photo = 'cmw3ysirk00gqwd3wbx75y980';
  const p15_photos = [
    'cmw3ysg0k00g6wd3wpw5jna2y',
    'cmw3ysh2600gewd3w1z07jahv',
    'cmw3ysgbp00g8wd3wst0ibygk',
  ];

  const allTargetPhotos = [p9_photo, ...p15_photos];

  const facesInTargetPhotos = await prisma.face.findMany({
    where: { photoId: { in: allTargetPhotos } },
    include: { person: true },
  });

  console.log(`\nFaces in Target Photos (P9 and P15): Total ${facesInTargetPhotos.length} faces found:`);
  for (const f of facesInTargetPhotos) {
    const isP9 = f.photoId === p9_photo;
    const origin = isP9 ? 'Person 9 photo' : 'Person 15 photo';
    console.log(`  [${origin}] Face ${f.id.slice(0, 8)}: photo ${f.photoId.slice(0, 14)}.. | Assigned to: "${f.person?.name}" (${f.personId})`);
  }
}

main().finally(() => prisma.$disconnect());
