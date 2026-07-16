import type { SyntheticEvent } from 'react';
import { Box } from '@mui/material';
import { KHATMA_PLACEHOLDER_URL, khatmaArtworkUrl } from '@/content/seriesImages';

export interface KhatmaSeriesArtworkProps {
  imageName?: string;
  alt: string;
  variant: 'media' | 'avatar';
  size?: number;
}

/** Shared series artwork: wide card media in lists, compact avatar elsewhere. */
export function KhatmaSeriesArtwork({
  imageName,
  alt,
  variant,
  size = 72,
}: KhatmaSeriesArtworkProps) {
  const src = khatmaArtworkUrl(imageName);
  const fallbackToPlaceholder = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.dataset.placeholderFallback !== 'true') {
      event.currentTarget.dataset.placeholderFallback = 'true';
      event.currentTarget.src = KHATMA_PLACEHOLDER_URL;
    }
  };
  if (variant === 'media') {
    return (
      <Box
        component="img"
        src={src}
        alt={alt}
        onError={fallbackToPlaceholder}
        sx={{
          display: 'block',
          width: '100%',
          aspectRatio: '16 / 9',
          objectFit: 'cover',
          bgcolor: 'background.default',
        }}
      />
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={fallbackToPlaceholder}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        objectFit: 'cover',
        borderRadius: 3,
        bgcolor: 'background.default',
      }}
    />
  );
}
