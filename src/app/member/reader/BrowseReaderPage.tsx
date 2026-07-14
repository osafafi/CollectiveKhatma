import { useCallback, useEffect, useState } from 'react';
import {
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemberNavigate } from '@/app/routing/hooks';
import { useLastReadPage } from '@/app/persistence';
import { getQuranIndex, getSurahs } from '@/content/quran/loader';
import { toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { QuranPageContent, ReaderNav, StickyChrome } from './readerParts';
import {
  TOTAL_PAGES,
  clampPage,
  isReadablePage,
  prefetchNeighbors,
} from './readerPaging';

interface JumpOption {
  page: number;
  label: string;
}

/**
 * Member browse reader (`#/quran`, `#/quran/{page}`) — free reading over all 604
 * mushaf pages. The displayed page is derived from the URL (falling back to the
 * remembered last-read page), so navigation only pushes the hash and persists
 * `khatma.lastReadPage`; there is no second source of truth to keep in sync.
 */
export function BrowseReaderPage({ page: routePage }: { page: number | undefined }) {
  const navigate = useMemberNavigate();
  const [lastReadPage, setLastReadPage] = useLastReadPage();
  const page =
    routePage !== undefined && isReadablePage(routePage)
      ? clampPage(routePage)
      : lastReadPage;

  const goToPage = useCallback(
    (next: number): void => {
      if (!isReadablePage(next) || next === page) return;
      setLastReadPage(next);
      navigate({ name: 'quran', page: next });
    },
    [page, navigate, setLastReadPage],
  );

  // Scroll to the top on each page change, matching the legacy `go()`.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    prefetchNeighbors(
      Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1),
      page - 1,
    );
  }, [page]);

  const indicator = `${strings.reader.page} ${toArabicDigits(page)} ${strings.reader.of} ${toArabicDigits(TOTAL_PAGES)}`;

  return (
    <Stack spacing={4} data-react-surface="member" data-route="quran">
      <StickyChrome>
        <Typography
          component="h1"
          color="primary.main"
          sx={{ textAlign: 'center', fontSize: '1.125rem', fontWeight: 700 }}
        >
          {strings.reader.browseTitle}
        </Typography>
        <ReaderNav
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          atStart={page <= 1}
          atEnd={page >= TOTAL_PAGES}
          indicator={indicator}
        />
        <JumpControls page={page} onJump={goToPage} />
      </StickyChrome>

      <QuranPageContent page={page} />
    </Stack>
  );
}

/** Surah, juz, and page jump controls. Options populate async and are silently omitted on failure. */
function JumpControls({
  page,
  onJump,
}: {
  page: number;
  onJump: (page: number) => void;
}) {
  const [surahOptions, setSurahOptions] = useState<JumpOption[]>([]);
  const [juzOptions, setJuzOptions] = useState<JumpOption[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([getSurahs(), getQuranIndex()])
      .then(([surahs, quranIndex]) => {
        if (!active) return;
        setSurahOptions(
          surahs.map((surah) => ({
            page: surah.pageStart,
            label: `${toArabicDigits(surah.id)}. ${surah.name}`,
          })),
        );
        const juz: JumpOption[] = [];
        for (let j = 1; j <= 30; j++) {
          const first = quranIndex.juzToPages[j]?.[0];
          if (first)
            juz.push({
              page: first,
              label: `${strings.reader.juz} ${toArabicDigits(j)}`,
            });
        }
        setJuzOptions(juz);
      })
      .catch(() => {
        // Jump controls are a convenience; reading still works without them.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Stack
      direction="row"
      spacing={2}
      useFlexGap
      sx={{ flexWrap: 'wrap', alignItems: 'center' }}
    >
      <JumpSelect label={strings.reader.surah} options={surahOptions} onJump={onJump} />
      <JumpSelect label={strings.reader.juz} options={juzOptions} onJump={onJump} />
      {/* Remount on committed-page change so the draft resyncs without an effect. */}
      <PageJumpInput key={page} page={page} onJump={onJump} />
    </Stack>
  );
}

/** A reset-on-select jump menu: it triggers navigation without tracking a value. */
function JumpSelect({
  label,
  options,
  onJump,
}: {
  label: string;
  options: readonly JumpOption[];
  onJump: (page: number) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 128 }}>
      <Select
        value=""
        displayEmpty
        renderValue={() => label}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isInteger(next)) onJump(next);
        }}
        SelectDisplayProps={{ 'aria-label': label }}
      >
        {options.map((option, index) => (
          <MenuItem key={`${option.page}-${index}`} value={option.page}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/**
 * Number input that shows the current page and jumps on commit (blur/Enter).
 * Remounted (via `key={page}`) whenever the committed page changes, so the draft
 * resyncs from the fresh mount instead of an effect.
 */
function PageJumpInput({
  page,
  onJump,
}: {
  page: number;
  onJump: (page: number) => void;
}) {
  const [draft, setDraft] = useState(String(page));

  const commit = (): void => {
    const next = Number(draft);
    if (isReadablePage(next) && next !== page) onJump(next);
    else setDraft(String(page));
  };

  return (
    <TextField
      type="number"
      size="small"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
      slotProps={{
        htmlInput: {
          min: 1,
          max: TOTAL_PAGES,
          inputMode: 'numeric',
          'aria-label': strings.reader.goToPage,
        },
      }}
      sx={{ width: 96, '& input': { fontVariantNumeric: 'tabular-nums' } }}
    />
  );
}
