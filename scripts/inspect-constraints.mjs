import { prisma } from '../src/lib/db.ts';

async function main() {
  const constraints = await prisma.$queryRaw`
    SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) as def, conrelid::regclass::text as table_name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid IN ('"Photo"'::regclass, '"PhotoAsset"'::regclass);
  `;
  console.log('Constraints on Photo and PhotoAsset:');
  console.log(constraints);

  const indexes = await prisma.$queryRaw`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('Photo', 'PhotoAsset');
  `;
  console.log('Indexes on Photo and PhotoAsset:');
  console.log(indexes);
}

main().finally(() => prisma.$disconnect());
