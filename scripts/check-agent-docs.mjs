import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const skippedDirectories = new Set(['.git', 'dist', 'node_modules']);
const requiredFiles = [
  'AGENTS.md',
  'docs/areas/admin-app.md',
  'docs/areas/distribution.md',
  'docs/areas/khatmas.md',
  'docs/areas/member-app.md',
  'docs/areas/operations.md',
  'docs/areas/people.md',
  'docs/areas/quran-data.md',
  'docs/areas/shared-ui.md',
  '.agents/skills/ship-ranqur-change/SKILL.md',
];
const routeShellLimits = {
  'src/app/admin/pages/KhatmaPage.tsx': 120,
  'src/app/admin/pages/KhatmasPage.tsx': 120,
  'src/app/member/KhatmaLandingPage.tsx': 120,
};

const errors = [];
const markdownFiles = await findMarkdown(root);
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

for (const file of requiredFiles) {
  if (!(await exists(resolve(root, file)))) errors.push(`Missing required file: ${file}`);
}

for (const command of [
  'check',
  'check:agent-docs',
  'typecheck',
  'lint',
  'test',
  'build',
]) {
  if (!packageJson.scripts?.[command]) errors.push(`Missing package script: ${command}`);
}

for (const [file, maxLines] of Object.entries(routeShellLimits)) {
  const lineCount = (await readFile(resolve(root, file), 'utf8')).split(/\r?\n/).length;
  if (lineCount > maxLines) {
    errors.push(`${file} is ${lineCount} lines; keep route shells under ${maxLines}`);
  }
}

for (const file of markdownFiles) {
  const text = await readFile(file, 'utf8');
  const display = relative(root, file).replaceAll('\\', '/');

  if (/react-migration|migration tracker|migration branch|\bRM-\d{3}\b/i.test(text)) {
    errors.push(`Obsolete migration breadcrumb: ${display}`);
  }

  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1]?.trim().replace(/^<|>$/g, '');
    if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;

    const cleanTarget = decodeURIComponent(rawTarget.split('#')[0]?.split('?')[0] ?? '');
    if (!cleanTarget) continue;

    const target = resolve(dirname(file), cleanTarget);
    if (!(await exists(target))) errors.push(`Broken link: ${display} -> ${rawTarget}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Agent docs OK (${markdownFiles.length} Markdown files checked).`);
}

async function findMarkdown(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await findMarkdown(path)));
    else if (entry.isFile() && entry.name.endsWith('.md')) found.push(path);
  }
  return found;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
