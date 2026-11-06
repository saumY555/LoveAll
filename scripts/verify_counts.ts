import { prisma } from '../src/lib/db';

async function main() {
  const p1 = '25410fb5-086a-4423-94de-3dad7a9bc9e0'; // Person 25
  const p2 = '72908895-7702-4318-b3ae-7169863849b0'; // Person 37

  const c1 = await prisma.photo.count({
    where: { faces: { some: { personId: p1 } }, isDeleted: false },
  });

  const c2 = await prisma.photo.count({
    where: { faces: { some: { personId: p2 } }, isDeleted: false },
  });

  const cEither = await prisma.photo.count({
    where: {
      faces: { some: { personId: { in: [p1, p2] } } },
      isDeleted: false,
    },
  });

  const cTogether = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT f."photoId") as count
    FROM "Face" f
    JOIN "Photo" p ON p.id = f."photoId"
    WHERE f."personId" IN (${p1}, ${p2})
      AND p."isDeleted" = false
    GROUP BY f."photoId"
    HAVING COUNT(DISTINCT f."personId") = 2;
  `;

  console.log(`Person 25 photos: ${c1}`);
  console.log(`Person 37 photos: ${c2}`);
  console.log(`Either (Union): ${cEither}`);
  console.log(`Together (Intersection): ${cTogether.length}`);
  console.log(`Check: cEither (${cEither}) = c1 (${c1}) + c2 (${c2}) - cTogether (${cTogether.length}) = ${c1 + c2 - cTogether.length}`);
}

main().finally(() => prisma.$disconnect());
