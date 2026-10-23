import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useMemberNavigate } from '@/app/routing/hooks';
import { memberHash } from '@/app/routing/routes';
import {
  forgetAssignedReaderPage,
  readAssignedReaderPage,
  rememberAssignedReaderPage,
} from '@/app/persistence';
import {
  AppButton,
  KhatmaSeriesArtwork,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import { seriesTitle } from '@/domain/series';
import type { Khatma, WirdCompletion } from '@/domain/types';
import { wirdCompletedOn } from '@/domain/wird';
import { startMushafPrefetch } from '../install/mushafPrefetch';
import {
  QuranPageContent,
  ReaderBackground,
  ReaderNav,
  StickyChrome,
} from '../reader/readerParts';
import { clampIndex, openingIndex, prefetchNeighbors } from '../reader/readerPaging';
import { WirdFinishAction } from './WirdFinishAction';
import { useLocalDate } from '../useLocalDate';

export function WirdReaderPage({
  wird,
  completions,
  memberId,
  memberName,
  routePage,
}: {
  wird: Khatma;
  completions: readonly WirdCompletion[];
  memberId: string;
  memberName: string;
  routePage?: number;
}) {
  const date = useLocalDate();
  const storedDone = wirdCompletedOn(completions, memberId, date);
  if (wird.scope.kind === 'dua') {
    return (
      <Stack spacing={4} data-react-surface="member" data-route="wirdRead">
        <WirdReaderHeader wird={wird} memberName={memberName} />
        <SurfaceCard>
          <Typography className="quran-text" sx={{ whiteSpace: 'pre-wrap' }}>
            {wird.wirdDuaText}
          </Typography>
        </SurfaceCard>
        <WirdFinishAction
          wirdId={wird.id}
          memberId={memberId}
          date={date}
          contentKind="dua"
          pages={[]}
          storedDone={storedDone}
          showReadButton={false}
        />
      </Stack>
    );
  }
  return (
    <WirdQuranReader
      key={`${wird.id}:${date}:${wird.remainingPages.join(',')}`}
      wird={wird}
      memberId={memberId}
      memberName={memberName}
      date={date}
      pages={wird.remainingPages}
      routePage={routePage}
      storedDone={storedDone}
    />
  );
}

function WirdQuranReader({
  wird,
  memberId,
  memberName,
  date,
  pages,
  routePage,
  storedDone,
}: {
  wird: Khatma;
  memberId: string;
  memberName: string;
  date: string;
  pages: readonly number[];
  routePage?: number;
  storedDone: boolean;
}) {
  const navigate = useMemberNavigate();
  const [index, setIndex] = useState(() =>
    openingIndex(pages, [
      routePage,
      storedDone ? null : readAssignedReaderPage(wird.id, memberId),
    ]),
  );
  const page = pages[index] ?? 1;
  const go = (nextIndex: number) => {
    const clamped = clampIndex(nextIndex, pages.length);
    if (clamped === index) return;
    setIndex(clamped);
    navigate(
      { name: 'khatmaRead', id: wird.id, page: pages[clamped] },
      { replace: true },
    );
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (storedDone) forgetAssignedReaderPage(wird.id, memberId);
    else rememberAssignedReaderPage(wird.id, memberId, page);
  }, [memberId, page, storedDone, wird.id]);
  useEffect(() => prefetchNeighbors(pages, index), [index, pages]);
  useEffect(() => startMushafPrefetch(pages), [pages]);

  return (
    <Stack spacing={4} data-react-surface="member" data-route="wirdRead">
      <ReaderBackground />
      <Box>
        <WirdReaderHeader wird={wird} memberName={memberName} />
        <QuranPageContent page={page} showSurahName />
      </Box>
      <StickyChrome>
        <ReaderNav
          onPrev={() => go(index - 1)}
          onNext={() => go(index + 1)}
          atStart={index === 0}
          atEnd={index === pages.length - 1}
          indicator={`${strings.reader.page} ${toWesternDigits(page)}`}
          progressIndicator={`${toWesternDigits(index + 1)} ${strings.reader.of} ${toWesternDigits(pages.length)}`}
        />
      </StickyChrome>
      <WirdFinishAction
        wirdId={wird.id}
        memberId={memberId}
        date={date}
        contentKind="quran"
        pages={pages}
        storedDone={storedDone}
        showReadButton={false}
      />
    </Stack>
  );
}

function WirdReaderHeader({ wird, memberName }: { wird: Khatma; memberName: string }) {
  return (
    <Box
      sx={(theme) => ({
        position: 'relative',
        mx: -4,
        mt: -4,
        mb: 3,
        px: 4,
        py: 2.5,
        background: theme.custom.wirdHeroGrad,
        color: theme.custom.heroInk,
        '& :focus-visible': { outlineColor: theme.custom.heroInk },
        borderRadius: {
          xs: `0 0 ${theme.custom.radii.hero}px ${theme.custom.radii.hero}px`,
          lg: `${theme.custom.radii.card}px`,
        },
      })}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={wird.imageName}
          alt={strings.admin.seriesImageAlt}
          size={48}
        />
        <Stack spacing={0.75} sx={{ flex: 1 }}>
          <Typography component="h1" variant="h3" color="inherit">
            {strings.reader.wirdAssignedTitle}
          </Typography>
          <Typography variant="body2">
            {seriesTitle(wird, toWesternDigits)} · {memberName}
          </Typography>
        </Stack>
        <StatusChip tone="wird" label={strings.member.wirdBadge} />
      </Stack>
      <AppButton
        quiet
        variant="text"
        href={memberHash.khatma(wird.id)}
        sx={{ mt: 1, color: 'inherit' }}
      >
        {strings.common.back}
      </AppButton>
    </Box>
  );
}
