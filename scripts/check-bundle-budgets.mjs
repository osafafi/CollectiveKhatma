import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const outputDirectory = resolve('dist');
const manifestPath = resolve(outputDirectory, '.vite/manifest.json');

// 2026-07: redesign landed (theme factory with a light+dark token map, motion
// keyframes, hero header chrome; fonts unchanged). Measured after Phase 6:
// member 353.7/518.4 kB, admin 358.4/523.2 kB — budgets hold ~5-10 kB slack.
const budgets = {
  member: {
    entry: 'index.html',
    initialJavaScriptGzipBytes: 360_000,
    initialTransferBytes: 528_000,
  },
  admin: {
    entry: 'admin-nano.html',
    initialJavaScriptGzipBytes: 368_000,
    initialTransferBytes: 533_000,
  },
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

function collectInitialGraph(entryKey) {
  const javascript = new Set();
  const stylesheets = new Set();
  const assets = new Set();
  const visited = new Set();

  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);

    const chunk = manifest[key];
    if (!chunk) {
      throw new Error(`Manifest entry ${key} was not found.`);
    }

    if (chunk.file?.endsWith('.js')) javascript.add(chunk.file);
    for (const stylesheet of chunk.css ?? []) stylesheets.add(stylesheet);
    for (const asset of chunk.assets ?? []) assets.add(asset);
    for (const importedKey of chunk.imports ?? []) visit(importedKey);
  }

  visit(entryKey);
  return { javascript, stylesheets, assets };
}

async function gzipBytes(files) {
  let bytes = 0;
  for (const file of files) {
    bytes += gzipSync(await readFile(resolve(outputDirectory, file))).byteLength;
  }
  return bytes;
}

async function rawBytes(files) {
  let bytes = 0;
  for (const file of files) {
    bytes += (await readFile(resolve(outputDirectory, file))).byteLength;
  }
  return bytes;
}

function formatKilobytes(bytes) {
  return `${(bytes / 1_000).toFixed(2)} kB`;
}

let failed = false;

console.log('Surface | Initial JS gzip | Initial transfer | JS budget | Transfer budget');
console.log('------- | --------------- | ---------------- | --------- | ---------------');

for (const [surface, budget] of Object.entries(budgets)) {
  const graph = collectInitialGraph(budget.entry);
  const htmlGzipBytes = await gzipBytes([budget.entry]);
  const javascriptGzipBytes = await gzipBytes(graph.javascript);
  const stylesheetGzipBytes = await gzipBytes(graph.stylesheets);
  // WOFF2 and image assets are already compressed, so count their emitted bytes.
  const assetBytes = await rawBytes(graph.assets);
  const initialTransferBytes =
    htmlGzipBytes + javascriptGzipBytes + stylesheetGzipBytes + assetBytes;

  console.log(
    `${surface} | ${formatKilobytes(javascriptGzipBytes)} | ${formatKilobytes(initialTransferBytes)} | ${formatKilobytes(budget.initialJavaScriptGzipBytes)} | ${formatKilobytes(budget.initialTransferBytes)}`,
  );

  if (javascriptGzipBytes > budget.initialJavaScriptGzipBytes) {
    console.error(
      `${surface} initial JavaScript exceeds its budget by ${formatKilobytes(javascriptGzipBytes - budget.initialJavaScriptGzipBytes)}.`,
    );
    failed = true;
  }

  if (initialTransferBytes > budget.initialTransferBytes) {
    console.error(
      `${surface} initial transfer exceeds its budget by ${formatKilobytes(initialTransferBytes - budget.initialTransferBytes)}.`,
    );
    failed = true;
  }
}

if (failed) process.exitCode = 1;
