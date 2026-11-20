import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { prisma } from '../src/lib/db';

async function run() {
  const eventId = 'cmw909qrh001dwdkw3261i6oa';
  console.log('Triggering force rescan for 19-photo event:', eventId);
  await prisma.photo.updateMany({
    where: { eventId, isDeleted: false },
    data: { faceStatus: 'PENDING', faceError: null }
  });

  const t0 = Date.now();
  while (true) {
    const counts = await prisma.photo.groupBy({
      by: ['faceStatus'],
      where: { eventId, isDeleted: false },
      _count: { _all: true }
    });
    const pending = counts.find((c) => c.faceStatus === 'PENDING')?._count._all || 0;
    const processing = counts.find((c) => c.faceStatus === 'PROCESSING')?._count._all || 0;
    const done = counts.find((c) => c.faceStatus === 'DONE')?._count._all || 0;
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('[Status] Done: ' + done + ', Pending: ' + pending + ', Processing: ' + processing + ' (' + elapsed + 's)');
    if (pending === 0 && processing === 0) {
      console.log('19-photo scan complete in ' + elapsed + 's!');
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
