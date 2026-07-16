export const KHATMA_PLACEHOLDER_IMAGE = 'placeholder.svg';

/** Image filenames discovered from public/khatma-images by the Vite config. */
export const availableSeriesImages = __KHATMA_SERIES_IMAGES__.filter(
  (name) => name !== KHATMA_PLACEHOLDER_IMAGE,
);

export function khatmaArtworkUrl(imageName?: string): string {
  const resolvedName = imageName?.trim() || KHATMA_PLACEHOLDER_IMAGE;
  return `${import.meta.env.BASE_URL}khatma-images/${encodeURIComponent(resolvedName)}`;
}

export const KHATMA_PLACEHOLDER_URL = khatmaArtworkUrl();
