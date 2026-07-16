import { describe, expect, it } from 'vitest';
import { publicKhatmaImages } from '../../scripts/khatma-image-catalog';

describe('public khatma image catalog', () => {
  it('discovers supported project images and ignores documentation files', () => {
    const images = publicKhatmaImages(process.cwd());
    expect(images).toContain('placeholder.svg');
    expect(images).toContain('green-arch.svg');
    expect(images).not.toContain('README.md');
  });
});
