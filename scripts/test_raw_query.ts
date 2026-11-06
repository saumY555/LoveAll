import { prisma } from '../src/lib/db';

async function main() {
  const ids = [
    '25410fb5-086a-4423-94de-3dad7a9bc9e0',
    '72908895-7702-4318-b3ae-7169863849b0',
  ];
  const eventId = 'cmw1yvai90000wdwogvbw9xka';

  // Test 1: Using Prisma.join or raw array
  try {
    const res1 = await prisma.$queryRaw<Array<{ photoId: string }>>`
      SELECT f."photoId"
      FROM "Face" f
      JOIN "Photo" p ON p.id = f."photoId"
      WHERE f."personId" = ANY(${ids}::text[])
        AND p."eventId" = ${eventId}
        AND p."isDeleted" = false
      GROUP BY f."photoId"
      HAVING COUNT(DISTINCT f."personId") = ${ids.length}
    `;
    console.log('Test 1 (ANY) succeeded, count:', res1.length);
  } catch (err: any) {
    console.error('Test 1 error:', err.message);
  }

  // Test 2: Using Prisma.join with IN
  try {
    const { Prisma } = await import('@prisma/client');
    const res2 = await prisma.$queryRaw<Array<{ photoId: string }>>`
      SELECT f."photoId"
      FROM "Face" f
      JOIN "Photo" p ON p.id = f."photoId"
      WHERE f."personId" IN (${Prisma.join(ids)})
        AND p."eventId" = ${eventId}
        AND p."isDeleted" = false
      GROUP BY f."photoId"
      HAVING COUNT(DISTINCT f."personId") = ${ids.length}
    `;
    console.log('Test 2 (IN Prisma.join) succeeded, count:', res2.length);
  } catch (err: any) {
    console.error('Test 2 error:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
