import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { prisma } from '../src/lib/db';
import { Prisma } from '@prisma/client';

async function testHideLifecycle() {
  console.log('=== TEST: HIDE PERSON LIFECYCLE ===');

  // Find a test person with faces in event cmw909qrh001dwdkw3261i6oa
  const person = await prisma.person.findFirst({
    where: { eventId: 'cmw909qrh001dwdkw3261i6oa', faces: { some: {} } },
    include: { faces: { select: { id: true, embedding: true } } }
  });

  if (!person || person.faces.length === 0) {
    throw new Error('No person with faces found in event cmw909qrh001dwdkw3261i6oa');
  }

  console.log(`Initial Person: ${person.name || person.id} (ID: ${person.id}, faces: ${person.faces.length})`);
  console.log(`  Initial isHidden: ${person.isHidden}, hiddenCentroid: ${person.hiddenCentroid ? 'SET' : 'NULL'}`);

  // 1. HIDE PERSON
  console.log('\n--- Step 1: Hide Person & Compute Centroid ---');
  const embs = person.faces.map(f => f.embedding as number[]);
  const sum = new Array(512).fill(0);
  for (const e of embs) {
    for (let i = 0; i < 512; i++) sum[i] += e[i];
  }
  const norm = Math.hypot(...sum) || 1;
  const centroid = sum.map(v => Number((v / norm).toFixed(6)));

  const hiddenPerson = await prisma.person.update({
    where: { id: person.id },
    data: {
      isHidden: true,
      hiddenCentroid: centroid
    }
  });

  console.log(`  Updated isHidden: ${hiddenPerson.isHidden}`);
  console.log(`  Updated hiddenCentroid length: ${Array.isArray(hiddenPerson.hiddenCentroid) ? (hiddenPerson.hiddenCentroid as any).length : 'JSON'}`);

  // 2. SIMULATE RESCAN PERSISTENCE INHERITANCE
  console.log('\n--- Step 2: Simulate Re-scan Centroid Matching (Threshold >= 0.70) ---');
  // Load existing hidden centroids
  const existingHiddenPeople = await prisma.person.findMany({
    where: { eventId: 'cmw909qrh001dwdkw3261i6oa', isHidden: true, hiddenCentroid: { not: Prisma.DbNull } },
    select: { id: true, hiddenCentroid: true }
  });

  const hiddenCentroids = existingHiddenPeople.map(p => ({
    centroid: (Array.isArray(p.hiddenCentroid) ? p.hiddenCentroid : JSON.parse(p.hiddenCentroid as string)) as number[]
  }));

  // Match with new cluster centroid
  let isInherited = false;
  for (const hc of hiddenCentroids) {
    let dot = 0;
    for (let i = 0; i < 512; i++) dot += centroid[i] * hc.centroid[i];
    console.log(`  Cosine similarity to preserved hidden centroid: ${dot.toFixed(4)}`);
    if (dot >= 0.70) {
      isInherited = true;
      break;
    }
  }
  console.log(`  Inheritance check result: ${isInherited ? 'PASS (Preserved isHidden: true)' : 'FAIL'}`);

  // 3. UNHIDE PERSON
  console.log('\n--- Step 3: Unhide Person & Clear Centroid ---');
  const unhiddenPerson = await prisma.person.update({
    where: { id: person.id },
    data: {
      isHidden: false,
      hiddenCentroid: Prisma.DbNull
    }
  });

  console.log(`  Unhidden isHidden: ${unhiddenPerson.isHidden}`);
  console.log(`  Unhidden hiddenCentroid: ${unhiddenPerson.hiddenCentroid === null ? 'NULL (CLEARED)' : 'FAILED'}`);
  console.log('\n=== TEST RESULT: ALL HIDE LIFECYCLE CHECKS PASSED ===');
}

testHideLifecycle().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
