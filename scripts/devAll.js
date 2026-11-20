const { spawn, execSync } = require('child_process');

console.log('================================================================================');
console.log('Starting dev:all (Next.js App + Background Face Worker)');
console.log('================================================================================');

const env = {
  ...process.env,
  NODE_OPTIONS: '--dns-result-order=ipv4first',
};

const nextProc = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env,
});

const workerProc = spawn('npx', ['tsx', 'scripts/faceWorker.ts'], {
  stdio: 'inherit',
  shell: true,
  env,
});

let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[dev:all] Shutting down child processes...');

  if (process.platform === 'win32') {
    if (nextProc.pid) {
      try {
        execSync(`taskkill /pid ${nextProc.pid} /T /F`, { stdio: 'ignore' });
      } catch {}
    }
    if (workerProc.pid) {
      try {
        execSync(`taskkill /pid ${workerProc.pid} /T /F`, { stdio: 'ignore' });
      } catch {}
    }
  } else {
    try {
      nextProc.kill('SIGTERM');
    } catch {}
    try {
      workerProc.kill('SIGTERM');
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

nextProc.on('exit', (code) => {
  if (!isShuttingDown) {
    console.log(`[dev:all] Next.js process exited with code ${code}`);
    shutdown();
  }
});

workerProc.on('exit', (code) => {
  if (!isShuttingDown) {
    console.log(`[dev:all] Face worker process exited with code ${code}`);
    shutdown();
  }
});
