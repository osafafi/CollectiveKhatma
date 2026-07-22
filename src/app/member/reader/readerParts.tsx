import { useEffect, useState, type ReactNode } from 'react';
import { Box, GlobalStyles, Stack, Typography } from '@mui/material';
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
 * While a reader is mounted, the page behind the mushaf takes the warm
 * `readerBg` tone (frameless reading surface, mock 3a); unmount restores the
 * app background automatically.
 */
export function ReaderBackground() {
  return (
    <GlobalStyles
      styles={(theme) => ({ body: { backgroundColor: theme.custom.readerBg } })}
    />
  );
}

/**
 * Sticky top chrome, redesigned as the slim emerald hero band (mock 3a/4c):
 * still bleeds to the content-column edges and stays sticky; the solid
 * gradient replaces the old translucent blur.
 */
export function StickyChrome({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        position: 'sticky',
        top: 0,
        zIndex: 10,
        mx: -4,
        px: 4,
        pt: 2.5,
        pb: 3.5,
        overflow: 'hidden',
        background: theme.custom.heroGrad,
        color: theme.custom.heroInk,
        borderRadius: `0 0 ${theme.custom.radii.hero}px ${theme.custom.radii.hero}px`,
        boxShadow: theme.custom.cardShadow,
      })}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          background: theme.custom.heroGlow,
          pointerEvents: 'none',
        })}
      />
      <Box
        sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {children}
      </Box>
    </Box>
  );
}

interface ReaderNavProps {
  onPrev: () => void;
  onNext: () => void;
  atStart: boolean;
  atEnd: boolean;
  indicator: string;
  progressIndicator?: string;
}

/**
 * RTL book navigation: السابقة sits on the right and التالية on the left,
 * with matching primary treatments whenever each action is enabled. Assigned
 * reading adds its chunk progress above the mushaf page label.
 */
export function ReaderNav({
  onPrev,
  onNext,
  atStart,
  atEnd,
  indicator,
  progressIndicator,
}: ReaderNavProps) {
  return (
    <Stack
      direction="row"
      spacing={3}
      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
    >
      <AppButton onClick={onPrev} disabled={atStart} sx={{ opacity: atStart ? 0.4 : 1 }}>
        ‹ {strings.reader.prev}
      </AppButton>
      <Box
        component="span"
        sx={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.25,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'center',
        }}
      >
        {progressIndicator ? (
          <Typography
            component="span"
            color="inherit"
            sx={{ fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.3 }}
          >
            {progressIndicator}
          </Typography>
        ) : null}
        <Typography
          component="span"
          color={progressIndicator ? 'inherit' : 'text.secondary'}
          sx={{
            fontSize: '0.875rem',
            fontWeight: progressIndicator ? 600 : 400,
            lineHeight: 1.3,
          }}
        >
          {indicator}
        </Typography>
      </Box>
      <AppButton onClick={onNext} disabled={atEnd} sx={{ opacity: atEnd ? 0.4 : 1 }}>
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
// Page composition — turn a QuranPage into surah bands, Bismillah, and
// justified ayah runs with gold font-glyph ayah medallions. The mushaf text is
// frameless (edge-to-edge with the page padding) per the redesign.
// -----------------------------------------------------------------------------

function composePageBlocks(page: QuranPage, surahs: Map<number, Surah>): ReactNode[] {
  const blocks: ReactNode[] = [];
  let run: ReactNode[] = [];
  let runSurah = -1;
  let key = 0;

  const flush = (): void => {
    if (run.length === 0) return;
    blocks.push(
      <Box key={`run-${key++}`} component="p" className="quran-text" sx={{ m: 0 }}>
        {run}
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
    // The ayah-end medallion is the font glyph `۝`+number, colored gold via
    // the retained `.ayah-marker` rule — never an SVG (design decision).
    run.push(
      `${ayah.text} `,
      <span key={`marker-${ayah.surah}-${ayah.ayah}`} className="ayah-marker">
        {ayahEndMarker(ayah.ayah)}
      </span>,
      ' ',
    );
  }
  flush();
  return blocks;
}

/**
 * The compact surah band (mock 3a): emerald cartouche with gold eight-point
 * stars and the surah name in the Quran font; the bismillah follows as its own
 * centered gold line, outside the band.
 */
function SurahHeader({ surah }: { surah: Surah | undefined }) {
  return (
    <Box sx={{ my: 2 }}>
      <Box
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          px: 4,
          pt: 2.5,
          pb: 3,
          borderRadius: `${theme.custom.radii.button}px`,
          background: theme.custom.primaryBtnGradient,
          boxShadow: theme.custom.btnShadow,
        })}
      >
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            position: 'absolute',
            top: 0,
            insetInlineEnd: '-20%',
            width: 44,
            height: '200%',
            background: `linear-gradient(180deg, transparent, ${theme.custom.heroShimmer}, transparent)`,
            animation: `shimmer ${theme.custom.motion.floaty} ${theme.custom.motion.easingSoft} infinite`,
            pointerEvents: 'none',
          })}
        />
        <GoldStar />
        <Typography
          component="span"
          sx={(theme) => ({
            fontFamily: 'var(--font-quran)',
            fontSize: '1.375rem',
            // Vertical centering of the tall Quran face inside the compact
            // band (EXECUTION §6 gotcha).
            lineHeight: 1,
            transform: 'translateY(-3px)',
            position: 'relative',
            color: theme.custom.surahBandInk,
          })}
        >
          {surah ? `${strings.reader.surahHeading} ${surah.name}` : ''}
        </Typography>
        <GoldStar />
      </Box>
      {surah?.bismillahPre ? (
        <Box
          component="p"
          className="quran-text"
          sx={(theme) => ({
            mt: 3,
            mb: 0,
            textAlign: 'center',
            lineHeight: 'normal',
            fontSize: 'calc(1.2rem * var(--reading-scale))',
            color: theme.custom.goldInk,
          })}
        >
          {strings.reader.bismillah}
        </Box>
      ) : null}
    </Box>
  );
}

/** Two rotated gold squares + a center dot — the design's 8-point star. */
function GoldStar() {
  return (
    <Box
      component="svg"
      viewBox="0 0 32 32"
      aria-hidden="true"
      sx={{ width: 20, height: 20, flex: 'none', position: 'relative' }}
    >
      <Box component="rect" x={8} y={8} width={16} height={16} rx={2} sx={goldFill} />
      <Box
        component="rect"
        x={8}
        y={8}
        width={16}
        height={16}
        rx={2}
        transform="rotate(45 16 16)"
        sx={goldFill}
      />
      <Box
        component="circle"
        cx={16}
        cy={16}
        r={6}
        sx={(theme) => ({ fill: theme.palette.primary.dark })}
      />
    </Box>
  );
}

const goldFill = (theme: { custom: { gold: string } }) => ({ fill: theme.custom.gold });

function byId(surahs: Surah[]): Map<number, Surah> {
  return new Map(surahs.map((surah): [number, Surah] => [surah.id, surah]));
}
