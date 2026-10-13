import { execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEV_PORT = 5173;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const shouldReset = process.argv.includes('--reset');
const isWindows = process.platform === 'win32';

function getListeningPids(port: number) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return [
        ...new Set(
          output
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => Number(line.split(/\s+/).at(-1)))
            .filter((pid) => Number.isFinite(pid) && pid > 0)
        ),
      ];
    } else {
      const output = execSync(`ss -tlnp sport = :${port}`, { encoding: 'utf8' });
      const pids = [];
      for (const match of output.matchAll(/pid=(\d+)/g)) {
        pids.push(Number(match[1]));
      }
      return [...new Set(pids)];
    }
  } catch {
    return [];
  }
}

function getProcessName(pid: number) {
  if (!isWindows) return null;
  try {
    const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: 'utf8',
    }).trim();
    if (!output || output.startsWith('INFO:')) return null;
    const [imageName] = output.replace(/^"|"$/g, '').split('","');
    return imageName || null;
  } catch {
    return null;
  }
}

function sleep(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function killPid(pid: number) {
  try {
    if (isWindows) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

function ensureStablePort(port: number) {
  let pids = getListeningPids(port);

  if (pids.length === 0) return;

  console.log(
    `Port ${port} is in use by PID(s): ${pids.join(', ')}. Closing previous dev server(s)...`
  );

  for (const pid of pids) {
    killPid(pid);
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    pids = getListeningPids(port);
    if (pids.length === 0) return;
    for (const pid of pids) killPid(pid);
    sleep(200);
  }

  const remaining = getListeningPids(port);
  if (remaining.length > 0) {
    const labels = remaining.map(
      (pid) => `${pid}${getProcessName(pid) ? ` (${getProcessName(pid)})` : ''}`
    );
    console.error(`Unable to free port ${port}. Still in use by: ${labels.join(', ')}`);
    process.exit(1);
  }
}

function resetDevArtifacts() {
  rmSync(path.join(projectRoot, 'node_modules', '.vite'), { recursive: true, force: true });
  rmSync(path.join(projectRoot, '.vite-cache'), { recursive: true, force: true });
  rmSync(path.join(projectRoot, 'dist'), { recursive: true, force: true });
}

if (shouldReset) {
  console.log('Resetting local dev artifacts...');
  resetDevArtifacts();
}

ensureStablePort(DEV_PORT);

const vite = spawn(
  'npx',
  ['vite', '--port', String(DEV_PORT), '--strictPort', '--configLoader', 'native'],
  {
    stdio: 'inherit',
    shell: isWindows,
  }
);

vite.on('exit', (code) => {
  process.exit(code ?? 0);
});
