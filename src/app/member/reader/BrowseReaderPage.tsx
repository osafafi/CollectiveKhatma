import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useMemberNavigate } from '@/app/routing/hooks';
import { useLastReadPage } from '@/app/persistence';
import { getPage, getQuranIndex, getSurahs } from '@/content/quran/loader';
import { toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import {
  QuranPageContent,
  ReaderBackground,
  ReaderNav,
  StickyChrome,
} from './readerParts';
import {
  TOTAL_PAGES,
  clampPage,
  isReadablePage,
  prefetchNeighbors,
} from './readerPaging';

interface JumpOption {
  value: number;
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

  const indicator = `${strings.reader.page} ${toWesternDigits(page)} ${strings.reader.of} ${toWesternDigits(TOTAL_PAGES)}`;

  return (
    <Stack spacing={4} data-react-surface="member" data-route="quran">
      <ReaderBackground />
      <Box>
        <StickyChrome>
          <Typography
            component="h1"
            color="inherit"
            sx={{ textAlign: 'center', fontSize: '1.125rem', fontWeight: 800 }}
          >
            {strings.reader.browseTitle}
          </Typography>
          <JumpControls page={page} onJump={goToPage} />
        </StickyChrome>
        <QuranPageContent page={page} showSurahName />
      </Box>
      <ReaderNav
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
        atStart={page <= 1}
        atEnd={page >= TOTAL_PAGES}
        indicator={indicator}
      />
    </Stack>
  );
}

/** Surah, juz, and page jump controls. Selects track the loaded page metadata. */
function JumpControls({
  page,
  onJump,
}: {
  page: number;
  onJump: (page: number) => void;
}) {
  const [surahOptions, setSurahOptions] = useState<JumpOption[]>([]);
  const [juzOptions, setJuzOptions] = useState<JumpOption[]>([]);
  const [currentSurah, setCurrentSurah] = useState<number>();
  const [currentJuz, setCurrentJuz] = useState<number>();

  useEffect(() => {
    let active = true;
    Promise.all([getSurahs(), getQuranIndex(), getPage(page)])
      .then(([surahs, quranIndex, quranPage]) => {
        if (!active) return;
        setSurahOptions(
          surahs.map((surah) => ({
            value: surah.id,
            page: surah.pageStart,
            label: `${toWesternDigits(surah.id)}. ${surah.name}`,
          })),
        );
        const juz: JumpOption[] = [];
        for (let j = 1; j <= 30; j++) {
          const first = quranIndex.juzToPages[j]?.[0];
          if (first)
            juz.push({
              value: j,
              page: first,
              label: `${strings.reader.juz} ${toWesternDigits(j)}`,
            });
        }
        setJuzOptions(juz);
        setCurrentSurah(quranPage.surahIds[0]);
        setCurrentJuz(quranPage.juz);
      })
      .catch(() => {
        // Jump controls are a convenience; reading still works without them.
        if (active) {
          setCurrentSurah(undefined);
          setCurrentJuz(undefined);
        }
      });
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <Stack
      direction="row"
      spacing={2}
      useFlexGap
      sx={{
        flexWrap: 'nowrap',
        alignItems: 'end',
        justifyContent: 'center',
        width: '100%',
        // overflow: 'hidden',
      }}
    >
      <PageJumpInput key={page} page={page} onJump={onJump} />
      <JumpSelect
        label={strings.reader.surah}
        value={currentSurah}
        options={surahOptions}
        onJump={onJump}
      />
      <JumpSelect
        label={strings.reader.juz}
        value={currentJuz}
        options={juzOptions}
        onJump={onJump}
      />
      {/* Remount on committed-page change so the draft resyncs without an effect. */}
    </Stack>
  );
}

/** Frosted hero-pill treatment for the jump controls inside the chrome. */
const heroFieldSx = (theme: Theme) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.custom.heroPill,
    color: theme.custom.heroInk,
    borderRadius: `${theme.custom.radii.pill}px`,
    '& fieldset': { borderColor: theme.custom.heroPillBorder },
    '&:hover fieldset': { borderColor: theme.custom.heroPillBorder },
    '& .MuiSvgIcon-root': { color: theme.custom.heroInk },
  },
  '& .MuiInputLabel-root': { color: theme.custom.heroInk },
});

/** A page-synchronized select whose options retain their own jump targets. */
function JumpSelect({
  label,
  value,
  options,
  onJump,
}: {
  label: string;
  value: number | undefined;
  options: readonly JumpOption[];
  onJump: (page: number) => void;
}) {
  return (
    <FormControl size="small" sx={[{ minWidth: 128 }, heroFieldSx]}>
      <Select<number | ''>
        value={value ?? ''}
        displayEmpty
        renderValue={(selected) =>
          selected === ''
            ? label
            : (options.find((option) => option.value === selected)?.label ?? label)
        }
        onChange={(event) => {
          const option = options.find(
            ({ value: optionValue }) => optionValue === Number(event.target.value),
          );
          if (option) onJump(option.page);
        }}
        SelectDisplayProps={{ 'aria-label': label }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
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
      label={strings.reader.page}
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
      sx={[{ width: 96, '& input': { fontVariantNumeric: 'tabular-nums' } }, heroFieldSx]}
    />
  );
}
