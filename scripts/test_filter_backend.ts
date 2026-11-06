import { prisma } from '../src/lib/db';

async function main() {
  const event = await prisma.event.findFirst({
    where: { name: { contains: 'nepal trip 2', mode: 'insensitive' } },
  });

  if (!event) throw new Error('Event not found');

  const p1 = '25410fb5-086a-4423-94de-3dad7a9bc9e0'; // Person 25
  const p2 = '72908895-7702-4318-b3ae-7169863849b0'; // Person 37
  const crossEventPerson = 'cmw15d2e1000hwdacw2gcjjlb'; // Lena from another event

  console.log('Testing Backend API Logic via direct fetch on local server:');

  // Test 1: Single person
  const resSingle = await fetch(`http://localhost:3000/api/events/${event.id}/photos?personId=${p1}`);
  const dataSingle = await resSingle.json();
  console.log(`Test 1 (Single Person 25): status=${resSingle.status}, count=${dataSingle.pagination?.totalCount}`);

  // Test 2: Multi-person "all" (Together)
  const resTogether = await fetch(`http://localhost:3000/api/events/${event.id}/photos?personIds=${p1},${p2}&mode=all`);
  const dataTogether = await resTogether.json();
  console.log(`Test 2 (Together P25 & P37): status=${resTogether.status}, count=${dataTogether.pagination?.totalCount}`);

  // Test 3: Multi-person "any" (Either)
  const resEither = await fetch(`http://localhost:3000/api/events/${event.id}/photos?personIds=${p1},${p2}&mode=any`);
  const dataEither = await resEither.json();
  console.log(`Test 3 (Either P25 & P37): status=${resEither.status}, count=${dataEither.pagination?.totalCount}`);

  // Test 4: Pair with 0 photos together
  const pZero1 = '88b21b7e-0ef1-4889-bbc2-69f391b2c1fd'; // Person 20
  const pZero2 = '646ec20e-a236-4a03-9325-e710e0895d12'; // Person 23
  const resZero = await fetch(`http://localhost:3000/api/events/${event.id}/photos?personIds=${pZero1},${pZero2}&mode=all`);
  const dataZero = await resZero.json();
  console.log(`Test 4 (Together 0-pair): status=${resZero.status}, count=${dataZero.pagination?.totalCount}`);

  // Test 5: Cross-event personId rejection
  const resCross = await fetch(`http://localhost:3000/api/events/${event.id}/photos?personIds=${p1},${crossEventPerson}&mode=all`);
  const dataCross = await resCross.json();
  console.log(`Test 5 (Cross-event rejection): status=${resCross.status}, error="${dataCross.error}"`);
}

main().finally(() => prisma.$disconnect());
