import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SUPPORTED_IMAGE_FILE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

/** Discover the selectable image filenames committed under public/khatma-images. */
export function publicKhatmaImages(projectDirectory: string): string[] {
  const directory = resolve(projectDirectory, 'public/khatma-images');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SUPPORTED_IMAGE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}
