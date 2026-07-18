// Cross-platform killer for orphaned Firebase emulator processes.
//
// A crashed or force-closed session can leave the Firestore emulator (java)
// and the Firebase CLI hub/UI (node) holding their ports, which blocks the
// next `npm run emulators`. This frees them.
import { execSync } from 'node:child_process';
import { platform } from 'node:os';

// firestore + UI (firebase.json) plus the emulator hub / logging defaults.
const PORTS = [8080, 4000, 4400, 4500];
const isWindows = platform() === 'win32';

/** Return the set of PIDs listening on the given port. */
function pidsOnPort(port) {
  try {
    if (isWindows) {
      const out = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return new Set(
        out
          .split('\n')
          .filter((line) => line.includes('LISTENING'))
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((pid) => pid && pid !== '0'),
      );
    }
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(
      out
        .split('\n')
        .map((pid) => pid.trim())
        .filter(Boolean),
    );
  } catch {
    // No process on this port — findstr/lsof exit non-zero when there's no match.
    return new Set();
  }
}

const pids = new Set();
for (const port of PORTS) {
  for (const pid of pidsOnPort(port)) pids.add(pid);
}

if (pids.size === 0) {
  console.log(`No emulator processes found on ports ${PORTS.join(', ')}.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    if (isWindows) {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: ['ignore', 'ignore', 'ignore'] });
    } else {
      process.kill(Number(pid), 'SIGKILL');
    }
    console.log(`Killed process ${pid}.`);
  } catch (err) {
    console.warn(`Could not kill process ${pid}: ${err.message}`);
  }
}

console.log('Emulator ports freed.');
