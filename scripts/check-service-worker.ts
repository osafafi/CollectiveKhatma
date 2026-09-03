import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminOnlyOutputFiles, readViteManifest } from './pwa-precache';
import { QURAN_CACHE_NAME } from './sw-routes';

/**
 * Post-build gate for the generated member service worker.
 *
 * `dist/sw.js` is served to every member and readable by anyone, so it must not
 * name the hidden admin entry — that unguessable filename is the only gate on
 * the admin panel (ARCHITECTURE.md#security). The unit tests cover the
 * selection logic; this checks the artifact that actually ships.
 *
 * Run by `npm run check` and in CI after the production build.
 */

const projectRoot = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(projectRoot, 'dist');
const MEMBER_ENTRY = 'index.html';

/**
 * Deployable entries other than the member app. Discovered from disk rather
 * than hard-coded so that replacing the admin slug — which `vite.config.ts`
 * tells deployers to do — keeps this check honest.
 */
function hiddenEntryNames(): string[] {
  return readdirSync(projectRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .filter((name) => name !== MEMBER_ENTRY);
}

const failures: string[] = [];
const serviceWorker = readFileSync(resolve(outputDirectory, 'sw.js'), 'utf8');
const manifest = readViteManifest(outputDirectory);

if (!serviceWorker.includes(MEMBER_ENTRY)) {
  failures.push(
    `sw.js does not precache ${MEMBER_ENTRY} — the app would not open offline.`,
  );
}

if (!serviceWorker.includes(QURAN_CACHE_NAME)) {
  failures.push(
    `sw.js has no "${QURAN_CACHE_NAME}" runtime route — mushaf pages would be ` +
      `fetched from the network every time and vanish the moment it is gone.`,
  );
}

for (const hiddenEntry of hiddenEntryNames()) {
  const slug = hiddenEntry.replace(/\.html$/, '');
  if (serviceWorker.includes(slug)) {
    failures.push(
      `sw.js mentions the hidden entry "${hiddenEntry}". The precache manifest ` +
        `is world-readable, so this exposes the only gate on the admin panel.`,
    );
  }

  for (const file of adminOnlyOutputFiles(manifest, {
    member: MEMBER_ENTRY,
    admin: hiddenEntry,
  })) {
    if (serviceWorker.includes(file)) {
      failures.push(`sw.js precaches admin-only chunk "${file}".`);
    }
  }
}

if (failures.length > 0) {
  console.error('Service worker check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Service worker OK (member shell precached, hidden entry absent).');
