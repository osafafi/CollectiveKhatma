import { useEffect, useState, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AppButton } from '@/components/primitives';
import { getPage, getSurahs } from '@/content/quran/loader';
import type { QuranPage, Surah } from '@/content/quran/types';
import { ayahEndMarker } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';

/**
 * Shared building blocks for the two mushaf readers. Each reader owns its
 * current page (browse from the URL, assigned from keyed component state); these
 * parts render the sticky chrome, the prev/next nav row, and the async page body
 * with its stale-navigation guard. Pure paging helpers live in `readerPaging.ts`.
 */

/**
 * Sticky top chrome: bleeds to the content-column edges and blurs the scrolled
 * page beneath it, matching the legacy `sticky top-0 … backdrop-blur` band.
 */
export function StickyChrome({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        mx: -4,
        px: 4,
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderBottom: 1,
        borderColor: 'divider',
        backdropFilter: 'blur(8px)',
        bgcolor: (theme) => alpha(theme.palette.background.default, 0.95),
      }}
    >
      {children}
    </Box>
  );
}

interface ReaderNavProps {
  onPrev: () => void;
  onNext: () => void;
  atStart: boolean;
  atEnd: boolean;
  indicator: string;
}

/** Prev/next row with the between-them page indicator. */
export function ReaderNav({ onPrev, onNext, atStart, atEnd, indicator }: ReaderNavProps) {
  return (
    <Stack
      direction="row"
      spacing={3}
      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
    >
      <AppButton
        variant="outlined"
        size="small"
        onClick={onPrev}
        disabled={atStart}
        sx={{ opacity: atStart ? 0.4 : 1 }}
      >
        ‹ {strings.reader.prev}
      </AppButton>
      <Typography
        component="span"
        color="text.secondary"
        sx={{
          fontSize: '0.875rem',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'center',
        }}
      >
        {indicator}
      </Typography>
      <AppButton
        variant="outlined"
        size="small"
        onClick={onNext}
        disabled={atEnd}
        sx={{ opacity: atEnd ? 0.4 : 1 }}
      >
        {strings.reader.next} ›
      </AppButton>
    </Stack>
  );
}

/** Reader status line for the per-page loading and load-error messages. */
function ReaderMessage({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <Typography
      sx={{ py: 10, textAlign: 'center' }}
      color={danger ? 'error.main' : 'text.secondary'}
    >
      {text}
    </Typography>
  );
}

type LoadedPage =
  | { page: number; status: 'ready'; blocks: ReactNode[] }
  | { page: number; status: 'error' };

/**
 * Load and render a single mushaf page. Loading is derived from whether the
 * settled result matches the requested page, so the effect only calls setState
 * from its async callbacks. The `active` flag plus the page match are the
 * stale-navigation guard: a newer navigation always wins.
 */
export function QuranPageContent({ page }: { page: number }) {
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getPage(page), getSurahs()])
      .then(([data, surahs]) => {
        if (active)
          setLoaded({
            page,
            status: 'ready',
            blocks: composePageBlocks(data, byId(surahs)),
          });
      })
      .catch(() => {
        if (active) setLoaded({ page, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [page]);

  if (!loaded || loaded.page !== page)
    return <ReaderMessage text={strings.common.loading} />;
  if (loaded.status === 'error')
    return <ReaderMessage text={strings.quran.loadError} danger />;
  return <Stack spacing={2}>{loaded.blocks}</Stack>;
}

// -----------------------------------------------------------------------------
// Page composition — turn a QuranPage into surah headers, Bismillah, and
// justified ayah runs with medallion ayah numbers (mirrors the legacy reader).
// -----------------------------------------------------------------------------

function composePageBlocks(page: QuranPage, surahs: Map<number, Surah>): ReactNode[] {
  const blocks: ReactNode[] = [];
  let run: string[] = [];
  let runSurah = -1;
  let key = 0;

  const flush = (): void => {
    if (run.length === 0) return;
    blocks.push(
      <Box key={`run-${key++}`} component="p" className="quran-text" sx={{ m: 0 }}>
        {run.join(' ')}
      </Box>,
    );
    run = [];
  };

  for (const ayah of page.ayat) {
    if (ayah.surah !== runSurah) {
      flush();
      runSurah = ayah.surah;
      // A new surah begins on this page when its first ayah appears here.
      if (ayah.ayah === 1)
        blocks.push(<SurahHeader key={`head-${key++}`} surah={surahs.get(ayah.surah)} />);
    }
    const text = `${ayah.text} ${ayahEndMarker(ayah.ayah)}`;
    run.push(text);
  }
  flush();
  return blocks;
}

function SurahHeader({ surah }: { surah: Surah | undefined }) {
  return (
    <Box
      sx={{
        my: 2,
        px: 4,
        py: 1.5,
        textAlign: 'center',
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
        boxShadow: 1,
      }}
    >
      <Typography color="primary.main" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
        {surah ? `${strings.reader.surahHeading} ${surah.name}` : ''}
      </Typography>
      {surah?.bismillahPre ? (
        // leading-normal: don't inherit the mushaf body's tall line-height here.
        <Box
          component="p"
          className="quran-text"
          sx={{ mt: 1, mb: 0, textAlign: 'center', lineHeight: 'normal' }}
        >
          {strings.reader.bismillah}
        </Box>
      ) : null}
    </Box>
  );
}

function byId(surahs: Surah[]): Map<number, Surah> {
  return new Map(surahs.map((surah): [number, Surah] => [surah.id, surah]));
}
