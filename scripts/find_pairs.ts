import { prisma } from '../src/lib/db';

async function main() {
  const event = await prisma.event.findFirst({
    where: { name: { contains: 'nepal trip 2', mode: 'insensitive' } },
    include: {
      people: {
        select: { id: true, name: true },
      },
    },
  });

  if (!event) return;

  const peopleMap = new Map(event.people.map((p) => [p.id, p.name || 'Unnamed']));

  const pairs = await prisma.$queryRaw<Array<{ p1: string; p2: string; count: bigint }>>`
    SELECT f1."personId" as p1, f2."personId" as p2, COUNT(DISTINCT f1."photoId") as count
    FROM "Face" f1
    JOIN "Face" f2 ON f1."photoId" = f2."photoId" AND f1."personId" < f2."personId"
    JOIN "Photo" p ON p.id = f1."photoId"
    WHERE p."eventId" = ${event.id}
      AND p."isDeleted" = false
      AND f1."personId" IS NOT NULL
      AND f2."personId" IS NOT NULL
    GROUP BY f1."personId", f2."personId"
    ORDER BY count DESC
    LIMIT 5;
  `;

  console.log('Top co-occurring pairs:');
  for (const pair of pairs) {
    const name1 = peopleMap.get(pair.p1);
    const name2 = peopleMap.get(pair.p2);
    console.log(`  ${name1} (${pair.p1}) & ${name2} (${pair.p2}): ${pair.count} photos together`);
  }
}

main().finally(() => prisma.$disconnect());
