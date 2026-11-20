import { prisma } from '../src/lib/db';

async function main() {
  const eventId = 'cmw3ynszk0000wd3wjj5ntc5g';

  const [photosCount, facesCount, peopleCount] = await Promise.all([
    prisma.photo.count({ where: { eventId, isDeleted: false } }),
    prisma.face.count({ where: { photo: { eventId, isDeleted: false } } }),
    prisma.person.count({ where: { eventId } }),
  ]);

  console.log(`================================================================================`);
  console.log(`200-PHOTO EVENT SCAN STATS:`);
  console.log(`================================================================================`);
  console.log(`  Total Photos:  ${photosCount}`);
  console.log(`  Total Faces:   ${facesCount}`);
  console.log(`  Total People:  ${peopleCount}`);

  // Fetch all people with faces and photoIds
  const people = await prisma.person.findMany({
    where: { eventId },
    include: {
      faces: {
        select: {
          id: true,
          photoId: true,
          boxWidth: true,
          boxHeight: true,
          confidence: true,
          blurScore: true,
          brightness: true,
          yawDeg: true,
          thumbnailUrl: true,
        },
      },
    },
  });

  // Check cannot-link invariant: NO person has > 1 face from the same photo
  let cannotLinkViolations = 0;
  for (const p of people) {
    const photoIds = p.faces.map((f) => f.photoId);
    const unique = new Set(photoIds);
    if (unique.size !== photoIds.length) {
      cannotLinkViolations++;
      console.warn(`VIOLATION in ${p.name}: ${p.faces.length} faces across ${unique.size} unique photos!`);
    }
  }
  console.log(`  Cannot-Link Violations across ALL ${people.length} people: ${cannotLinkViolations}`);

  // Size distribution
  const multiPhotoPeople = people.filter((p) => new Set(p.faces.map((f) => f.photoId)).size >= 2);
  const singlePhotoPeople = people.filter((p) => new Set(p.faces.map((f) => f.photoId)).size === 1);
  console.log(`  Multi-Photo People (>= 2 photos): ${multiPhotoPeople.length}`);
  console.log(`  Single-Photo People (1 photo):    ${singlePhotoPeople.length}`);

  console.log(`\nTop 25 Multi-Photo People by Face Count:`);
  multiPhotoPeople.sort((a, b) => b.faces.length - a.faces.length);
  multiPhotoPeople.slice(0, 25).forEach((p, idx) => {
    const pids = new Set(p.faces.map((f) => f.photoId));
    console.log(`  ${idx + 1}. ${p.name} (${p.id}): ${p.faces.length} faces across ${pids.size} photos`);
  });

  // Now find where the 6 faces of original Person 15 are located
  // In earlier sessions, Person 15 had 6 faces across photos cmw3yt0gm00kh, cmw3yt81c00m3, cmw3yt9iy00mj
  const targetPhotoIds15 = ['cmw3yt0gm00kh', 'cmw3yt81c00m3', 'cmw3yt9iy00mj'];
  console.log(`\n================================================================================`);
  console.log(`CANNOT-LINK ANALYSIS FOR ORIGINAL PERSON 15 & PERSON 9:`);
  console.log(`================================================================================`);

  const p15Faces = await prisma.face.findMany({
    where: {
      photo: {
        eventId,
        OR: targetPhotoIds15.map((idPrefix) => ({ id: { startsWith: idPrefix } })),
      },
    },
    include: { person: true, photo: true },
  });

  console.log(`Faces from original Person 15's photos: ${p15Faces.length}`);
  const p15ByPerson = new Map<string, any[]>();
  for (const f of p15Faces) {
    const pName = f.person?.name || 'Unassigned';
    if (!p15ByPerson.has(pName)) p15ByPerson.set(pName, []);
    p15ByPerson.get(pName)!.push(f);
  }

  p15ByPerson.forEach((faces, pName) => {
    console.log(`  Cluster "${pName}": ${faces.length} face(s)`);
    faces.forEach((f) => {
      console.log(`    - Face ${f.id.slice(0, 8)}: photo ${f.photoId.slice(0, 14)}, box ${f.boxWidth}x${f.boxHeight}, conf ${f.confidence.toFixed(3)}`);
    });
  });
}

main().finally(() => prisma.$disconnect());
