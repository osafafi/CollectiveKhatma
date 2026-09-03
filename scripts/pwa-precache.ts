import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Precache selection for the member service worker.
 *
 * The build emits TWO entries (see `vite.config.ts`): the member app and the
 * hidden admin panel, whose unguessable filename is the only gate protecting it
 * (ARCHITECTURE.md#security). A service worker precache manifest ships inside
 * `sw.js`, which every member downloads and anyone can read — so the admin entry
 * and the chunks only it needs must never appear there. Excluding them also
 * keeps ~370 kB of admin-only JavaScript off member devices.
 */

interface ViteManifestChunk {
  file: string;
  css?: string[];
  assets?: string[];
  imports?: string[];
  dynamicImports?: string[];
}

export type ViteManifest = Record<string, ViteManifestChunk>;

/** One workbox precache entry; `url` is relative to the build output directory. */
export interface PrecacheEntry {
  url: string;
  revision?: string | null;
}

/**
 * Every output file reachable from one manifest entry, following static and
 * dynamic imports plus emitted CSS and assets. Dynamic imports count because a
 * lazily loaded admin route is still admin-only code.
 */
function reachableFiles(manifest: ViteManifest, entryKey: string): Set<string> {
  const files = new Set<string>();
  const visited = new Set<string>();

  function visit(key: string): void {
    if (visited.has(key)) return;
    visited.add(key);

    const chunk = manifest[key];
    if (!chunk) return;

    if (chunk.file) files.add(chunk.file);
    for (const stylesheet of chunk.css ?? []) files.add(stylesheet);
    for (const asset of chunk.assets ?? []) files.add(asset);
    for (const imported of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
      visit(imported);
    }
  }

  visit(entryKey);
  return files;
}

/**
 * Output files the admin entry needs that the member entry does not. Shared
 * vendors (MUI, Firebase, the rolldown runtime) reach both entries and stay.
 */
export function adminOnlyOutputFiles(
  manifest: ViteManifest,
  entries: { member: string; admin: string },
): string[] {
  const memberFiles = reachableFiles(manifest, entries.member);
  const adminFiles = reachableFiles(manifest, entries.admin);
  return [...adminFiles].filter((file) => !memberFiles.has(file)).sort();
}

/**
 * Drop the admin entry document and its exclusive chunks from a precache
 * manifest. Both entry keys stay build-time only — neither the excluded
 * filenames nor the admin entry name reach the generated `sw.js`.
 */
export function withoutAdminFiles<Entry extends { url: string }>(
  precache: readonly Entry[],
  manifest: ViteManifest,
  entries: { member: string; admin: string },
): Entry[] {
  const excluded = new Set([entries.admin, ...adminOnlyOutputFiles(manifest, entries)]);
  return precache.filter((entry) => !excluded.has(entry.url));
}

/** Read the build manifest Vite wrote for this output directory. */
export function readViteManifest(outputDirectory: string): ViteManifest {
  const manifestPath = resolve(outputDirectory, '.vite/manifest.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ViteManifest;
}
