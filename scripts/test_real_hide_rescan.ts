import { prisma } from '../src/lib/db';
import { Prisma } from '@prisma/client';
import { persistScanAndClusterTransaction, ClusterResult } from '../src/lib/faceService';
import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

async function cosineSim(a: number[], b: number[]): Promise<number> {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const eventId = 'cmw909qrh001dwdkw3261i6oa';

  // 1. Find Person 35 (6 faces)
  const targetPerson = await prisma.person.findFirst({
    where: { eventId, faces: { some: {} } },
    include: { faces: true },
    orderBy: { faces: { _count: 'desc' } },
  });

  if (!targetPerson || targetPerson.faces.length < 2) {
    throw new Error('Target person with multiple faces not found!');
  }

  console.log(`Step 1: Found target person "${targetPerson.name}" (${targetPerson.id}) with ${targetPerson.faces.length} faces.`);

  // Compute centroid
  const embs = targetPerson.faces.map((f) => f.embedding as number[]);
  const dim = embs[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embs) {
    for (let i = 0; i < dim; i++) centroid[i] += emb[i];
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    centroid[i] /= embs.length;
    norm += centroid[i] * centroid[i];
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < dim; i++) centroid[i] /= norm;

  // 2. Hide person in DB (as the Host PATCH route would do)
  await prisma.person.update({
    where: { id: targetPerson.id },
    data: {
      isHidden: true,
      hiddenCentroid: centroid,
    },
  });
  console.log(`Step 2: Person "${targetPerson.name}" marked isHidden=true with 512-d hiddenCentroid in DB.`);

  // 3. Fetch existing people before rescan
  const existingPeople = await prisma.person.findMany({
    where: { eventId },
    include: { faces: { select: { id: true } } },
  });
  const hiddenCountBefore = existingPeople.filter((p) => p.isHidden).length;
  console.log(`Step 3: Existing people in DB: ${existingPeople.length} (hidden: ${hiddenCountBefore}).`);

  // 4. Fetch all faces in the event and run real clustering via Python
  const allFaces = await prisma.face.findMany({
    where: { photo: { eventId, isDeleted: false } },
    select: { id: true, embedding: true, photoId: true },
  });
  console.log(`Step 4: Clustering ${allFaces.length} faces via python face_cli.py...`);

  const pythonPath = process.env.PYTHON_PATH || 'C:\\Users\\LENOVO\\AppData\\Local\\Python\\bin\\python.exe';
  const pyProcess = spawn(pythonPath, [
    path.resolve(process.cwd(), 'worker', 'face_cli.py'),
    'cluster',
    '--eps', '0.40',
    '--minSamples', '1'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  const inputPayload = JSON.stringify(
    allFaces.map((f) => ({
      id: f.id,
      embedding: f.embedding,
      photoId: f.photoId,
    }))
  );

  let errOut = '';
  pyProcess.stderr.on('data', (d) => {
    errOut += d.toString();
    process.stderr.write(d.toString());
  });
  const clusterOutput = await new Promise<any>((resolve, reject) => {
    let out = '';
    pyProcess.stdout.on('data', (d) => out += d.toString());
    pyProcess.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Python exited with code ${code}: ${errOut}`));
      resolve(JSON.parse(out));
    });
    pyProcess.stdin.write(inputPayload);
    pyProcess.stdin.end();
  });

  const clusterResult: ClusterResult = clusterOutput.result || clusterOutput;
  console.log(`Step 5: Python returned ${clusterResult.clusters.length} clusters.`);

  // 5. Run persistScanAndClusterTransaction (the exact scan path)
  const allFacesMap = new Map(allFaces.map((f) => [f.id, f as any]));
  await persistScanAndClusterTransaction({
    eventId,
    successfulPhotoIds: [],
    allDetectedFaces: [],
    clusterResult,
    existingPeople,
    allFacesMap,
  });

  // 6. Verify in DB that the newly generated cluster inherited isHidden: true
  const updatedPeople = await prisma.person.findMany({
    where: { eventId },
    include: { faces: true },
  });

  const hiddenPeople = updatedPeople.filter((p) => p.isHidden);
  console.log(`\nStep 6: Rescan complete! Total people: ${updatedPeople.length}, Hidden people: ${hiddenPeople.length}`);

  if (hiddenPeople.length === 0) {
    throw new Error('FAILURE: No person was re-hidden after rescan!');
  }

  const reHidden = hiddenPeople[0];
  const sim = await cosineSim(centroid, reHidden.hiddenCentroid as number[]);
  console.log(`SUCCESS: Person "${reHidden.name}" (${reHidden.id}) is hidden!`);
  console.log(`  Faces in re-hidden person: ${reHidden.faces.length}`);
  console.log(`  Similarity between original hidden centroid and inherited centroid: ${sim.toFixed(4)}`);

  // 7. Unhide (host action) and confirm hiddenCentroid is cleared
  console.log(`\nStep 7: Testing Host Unhide action...`);
  await prisma.person.update({
    where: { id: reHidden.id },
    data: {
      isHidden: false,
      hiddenCentroid: Prisma.DbNull,
    },
  });

  const unhiddenPerson = await prisma.person.findUnique({
    where: { id: reHidden.id },
  });

  console.log(`  After unhide: isHidden = ${unhiddenPerson?.isHidden}, hiddenCentroid = ${unhiddenPerson?.hiddenCentroid}`);
  if (unhiddenPerson?.isHidden === false && unhiddenPerson?.hiddenCentroid === null) {
    console.log(`ALL HIDE LIFECYCLE CHECKS PASSED: Hide -> Rescan -> Re-hidden -> Unhide (clears centroid)!\n`);
  } else {
    throw new Error('FAILURE: Unhide did not clear isHidden or hiddenCentroid properly.');
  }
}

main().finally(() => prisma.$disconnect());
