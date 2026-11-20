import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { prisma } from '../src/lib/db';

async function main() {
  const eventId = 'cmw909qrh001dwdkw3261i6oa';
  const people = await prisma.person.findMany({
    where: { eventId },
    include: {
      faces: {
        select: {
          id: true,
          photoId: true,
          confidence: true,
          boxWidth: true,
          boxHeight: true,
          blurScore: true,
          brightness: true,
          yawDeg: true,
          thumbnailUrl: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`=== 19-PHOTO EVENT FINAL PEOPLE AUDIT ===`);
  console.log(`Total people clusters in DB: ${people.length}`);

  let qualifiedCount = 0;
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const photoIds = new Set(p.faces.map(f => f.photoId));
    const isMultiPhoto = photoIds.size >= 2;
    const isHQSingleton =
      photoIds.size === 1 &&
      p.faces.length === 1 &&
      (p.faces[0].boxWidth ?? 0) >= 75 &&
      (p.faces[0].boxHeight ?? 0) >= 75 &&
      p.faces[0].confidence >= 0.85;

    const status = isMultiPhoto
      ? 'MULTI-PHOTO PERSON'
      : isHQSingleton
      ? 'HIGH-QUALITY SINGLETON'
      : 'OTHER FACES (LOW-Q / SINGLETON)';

    if (isMultiPhoto || isHQSingleton) {
      qualifiedCount++;
      console.log(`\n[Person ${qualifiedCount}] ${p.name || 'Unnamed'} (ID: ${p.id.slice(0, 8)}): ${status}`);
      console.log(`  Thumbnail: ${p.thumbnailUrl || p.faces[0]?.thumbnailUrl}`);
      console.log(`  Distinct Photos: ${photoIds.size}, Total Faces: ${p.faces.length}`);
      for (const f of p.faces) {
        console.log(`    Face ${f.id.slice(0, 8)} (photo ${f.photoId.slice(0, 8)}): box=${f.boxWidth}x${f.boxHeight}, blur=${f.blurScore}, bright=${f.brightness}, yaw=${f.yawDeg}, conf=${f.confidence}`);
      }
    }
  }

  console.log(`\n=========================================`);
  console.log(`FINAL PEOPLE IN STRIP: ${qualifiedCount} People`);
  console.log(`=========================================`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
