import { prisma } from '../src/lib/db';

async function main() {
  const eventId = 'cmw909qrh001dwdkw3261i6oa';

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      people: {
        include: {
          faces: {
            include: { photo: { select: { id: true } } },
          },
        },
      },
    },
  });

  if (!event) {
    console.error('Event not found');
    return;
  }

  console.log(`Total DB People in 19-photo event: ${event.people.length}`);

  const visiblePeople: Array<{
    personId: string;
    originalName: string;
    facesCount: number;
    distinctPhotos: number;
    faces: any[];
    reason: string;
  }> = [];

  const otherFaces: any[] = [];

  for (const person of event.people) {
    const photoIds = new Set(person.faces.map((f) => f.photoId));
    const distinctPhotos = photoIds.size;
    const facesCount = person.faces.length;

    if (distinctPhotos >= 2) {
      visiblePeople.push({
        personId: person.id,
        originalName: person.name ?? 'Unnamed',
        facesCount,
        distinctPhotos,
        faces: person.faces,
        reason: `${distinctPhotos} distinct photos`,
      });
    } else if (distinctPhotos === 1 && facesCount === 1) {
      const f = person.faces[0];
      const minBox = Math.min(f.boxWidth ?? 0, f.boxHeight ?? 0);
      const conf = f.confidence ?? 0;
      const b = f.brightness ?? 0;
      const blur = f.blurScore ?? 0;
      const yaw = Math.abs(f.yawDeg ?? 0);

      // Rule: box >= 75, conf >= 0.85, brightness >= 40.0, blur >= 20.0, abs(yaw) <= 80
      const isHqSingleton =
        minBox >= 75 &&
        conf >= 0.85 &&
        b >= 40.0 &&
        blur >= 20.0 &&
        (f.yawDeg === null || yaw <= 80);

      if (isHqSingleton) {
        visiblePeople.push({
          personId: person.id,
          originalName: person.name ?? 'Unnamed',
          facesCount: 1,
          distinctPhotos: 1,
          faces: person.faces,
          reason: `HQ Singleton (box=${f.boxWidth}x${f.boxHeight}, conf=${conf.toFixed(3)}, b=${b.toFixed(1)}, blur=${blur.toFixed(1)}, yaw=${f.yawDeg ?? 'null'})`,
        });
      } else {
        const dropReasons: string[] = [];
        if (minBox < 75) dropReasons.push(`box=${minBox}<75`);
        if (conf < 0.85) dropReasons.push(`conf=${conf.toFixed(2)}<0.85`);
        if (b < 40.0) dropReasons.push(`brightness=${b.toFixed(1)}<40(attach-only)`);
        if (blur < 20.0) dropReasons.push(`blur=${blur.toFixed(1)}<20`);
        if (f.yawDeg !== null && yaw > 80) dropReasons.push(`yaw=${f.yawDeg}>80`);
        otherFaces.push({
          faceId: f.id,
          personName: person.name,
          reasons: dropReasons.join(', '),
          box: `${f.boxWidth}x${f.boxHeight}`,
          conf: conf.toFixed(3),
          b: b.toFixed(1),
          blur: blur.toFixed(1),
        });
      }
    } else {
      // 1 distinct photo, but multiple faces? Cannot-link should prevent this or it's multiple faces in 1 photo
      person.faces.forEach((f) => {
        otherFaces.push({
          faceId: f.id,
          personName: person.name,
          reasons: `Single photo with ${facesCount} faces`,
        });
      });
    }
  }

  // Sort visible people: multi-photo first by photo count descending, then singletons
  visiblePeople.sort((a, b) => b.distinctPhotos - a.distinctPhotos || b.facesCount - a.facesCount);

  console.log('\n================================================================================');
  console.log(`VISIBLE PEOPLE IN STRIP (Total: ${visiblePeople.length} people, numbered 1..${visiblePeople.length}):`);
  console.log('================================================================================');
  visiblePeople.forEach((p, idx) => {
    const stripNumber = idx + 1;
    console.log(`Person ${stripNumber} (DB: "${p.originalName}", ID: ${p.personId}):`);
    console.log(`  Rule: ${p.reason}`);
    console.log(`  Faces: ${p.facesCount} face(s) across ${p.distinctPhotos} photo(s)`);
    p.faces.forEach((f) => {
      console.log(`    - Face ${f.id.slice(0, 8)}: photo ${f.photoId.slice(0, 8)}, box ${f.boxWidth}x${f.boxHeight}, conf ${f.confidence.toFixed(3)}, blur ${f.blurScore}, b ${f.brightness}, yaw ${f.yawDeg}`);
    });
  });

  console.log('\n================================================================================');
  console.log(`OTHER FACES (Total: ${otherFaces.length} faces routed to "Other faces" bucket):`);
  console.log('================================================================================');
  otherFaces.forEach((of, idx) => {
    console.log(`  ${idx + 1}. Face ${of.faceId.slice(0, 8)} (DB ${of.personName}): [${of.reasons}] (box ${of.box}, conf ${of.conf}, b ${of.b}, blur ${of.blur})`);
  });
}

main().finally(() => prisma.$disconnect());
