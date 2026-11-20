import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { prisma } from '../src/lib/db';

async function timedRun200() {
  const eventId = 'cmw3ynszk0000wd3wjj5ntc5g';
  console.log('================================================================================');
  console.log('STARTING REAL MEASURED SCAN & CLUSTER RUN ON 200-PHOTO EVENT (force=true)');
  console.log('================================================================================');

  // Trigger force rescan: queue all photos
  await prisma.photo.updateMany({
    where: { eventId, isDeleted: false },
    data: { faceStatus: 'PENDING', faceError: null },
  });

  const startTime = Date.now();
  let lastReport = Date.now();

  while (true) {
    const counts = await prisma.photo.groupBy({
      by: ['faceStatus'],
      where: { eventId, isDeleted: false },
      _count: { _all: true },
    });

    const pending = counts.find((c) => c.faceStatus === 'PENDING')?._count._all || 0;
    const processing = counts.find((c) => c.faceStatus === 'PROCESSING')?._count._all || 0;
    const done = counts.find((c) => c.faceStatus === 'DONE')?._count._all || 0;
    const total = pending + processing + done;

    const elapsedSec = (Date.now() - startTime) / 1000;

    if (Date.now() - lastReport >= 5000 || (pending === 0 && processing === 0)) {
      lastReport = Date.now();
      const pct = total > 0 ? ((done / total) * 100).toFixed(1) : '0';
      console.log(
        `[${elapsedSec.toFixed(1)}s] Progress: ${done}/${total} photos (${pct}%) | Pending: ${pending}, Processing: ${processing}`
      );
    }

    if (pending === 0 && processing === 0) {
      const totalDurationSec = (Date.now() - startTime) / 1000;
      console.log('================================================================================');
      console.log(`REAL TIMED RUN COMPLETE!`);
      console.log(`Total Photos Processed: ${done} photos`);
      console.log(`Total Wall Clock Time:  ${totalDurationSec.toFixed(2)} seconds`);
      console.log(`Average Per-Photo Time: ${(totalDurationSec / done).toFixed(3)} seconds (${((totalDurationSec / done) * 1000).toFixed(0)} ms/photo)`);
      console.log('================================================================================');
      break;
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

timedRun200().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
