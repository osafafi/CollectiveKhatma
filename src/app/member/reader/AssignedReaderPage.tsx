import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { selectAssignmentsForKhatma, selectKhatmas, useAppSelector } from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import { memberHash } from '@/app/routing/routes';
import { AppButton, NoticeBanner, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { isRoundDone, latestReadableChunk } from '@/domain/progress';
import type { RoundChunk } from '@/domain/types';
import { useMemberIdentity } from '../memberIdentityContext';
import { QuranPageContent, ReaderNav, StickyChrome } from './readerParts';
import { clampIndex, prefetchNeighbors } from './readerPaging';

/**
 * Member assigned reader (`#/khatma/{id}/read`) — the current-round chunk with a
 * one-tap finish action. Resolution mirrors the legacy `showAssignedReader`: an
 * unloaded khatma list reads as loading, everything else that is not a readable
 * chunk of mine shows the back + "no pages" view.
 */
export function AssignedReaderPage({ khatmaId }: { khatmaId: string }) {
  const { memberId, member } = useMemberIdentity();
  const khatmas = useAppSelector(selectKhatmas);
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatmaId),
  );

  const khatma = khatmas.find(
    (candidate) =>
      candidate.id === khatmaId &&
      candidate.status === 'active' &&
      candidate.memberIds.includes(memberId),
  );

  // Empty khatma collection reads as loading (including before the first snapshot).
  if (khatmas.length === 0) return <LoadingCard />;
  if (!khatma) return <NoPagesView khatmaId={khatmaId} />;

  const paused = member ? !member.enabled : false;
  const mine = assignments.find((assignment) => assignment.memberId === memberId);
  // The member reads their current round's chunk (revisiting it once done).
  const chunk = mine && !paused ? latestReadableChunk(mine) : undefined;
  if (!chunk || chunk.pages.length === 0) return <NoPagesView khatmaId={khatmaId} />;

  return (
    // Key on the round so a new distribution remounts fresh, while unrelated
    // realtime ticks keep this instance — and its page/scroll — alive.
    <AssignedReaderCore
      key={`${khatmaId}:${chunk.round}`}
      khatmaId={khatmaId}
      memberId={memberId}
      chunk={chunk}
      storedDone={mine ? isRoundDone(mine, chunk.round) : false}
    />
  );
}

function AssignedReaderCore({
  khatmaId,
  memberId,
  chunk,
  storedDone,
}: {
  khatmaId: string;
  memberId: string;
  chunk: RoundChunk;
  storedDone: boolean;
}) {
  const pages = chunk.pages;
  const [index, setIndex] = useState(0);
  const page = pages[index] ?? 1;

  const go = (nextIndex: number): void => {
    const clamped = clampIndex(nextIndex, pages.length);
    if (clamped === index) return;
    setIndex(clamped);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    prefetchNeighbors(pages, index);
  }, [pages, index]);

  const indicator = `${strings.reader.page} ${toArabicDigits(page)} · ${toArabicDigits(index + 1)} ${strings.reader.of} ${toArabicDigits(pages.length)}`;

  return (
    <Stack spacing={4} data-react-surface="member" data-route="khatmaRead">
      <QuranPageContent page={page} />
      <StickyChrome>
        <ReaderNav
          onPrev={() => go(index - 1)}
          onNext={() => go(index + 1)}
          atStart={index === 0}
          atEnd={index === pages.length - 1}
          indicator={indicator}
        />
      </StickyChrome>

      <FinishFooter
        khatmaId={khatmaId}
        memberId={memberId}
        round={chunk.round}
        storedDone={storedDone}
      />
    </Stack>
  );
}

function FinishFooter({
  khatmaId,
  memberId,
  round,
  storedDone,
}: {
  khatmaId: string;
  memberId: string;
  round: number;
  storedDone: boolean;
}) {
  const markDone = useWriteOperation('markRoundDone');
  const done = storedDone || markDone.state.status === 'success';

  if (done) {
    return (
      <NoticeBanner tone="success" sx={{ textAlign: 'center', fontWeight: 600 }}>
        ✓ {strings.member.doneToday}
      </NoticeBanner>
    );
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 4 }}>
      <AppButton
        hero
        disabled={markDone.isPending}
        onClick={() => {
          void markDone.execute(khatmaId, memberId, round);
        }}
      >
        {strings.member.finishedToday}
      </AppButton>
      {markDone.state.status === 'failure' ? (
        <Typography role="alert" color="error.main" sx={{ mt: 2, textAlign: 'center' }}>
          {strings.member.saveError}
        </Typography>
      ) : null}
    </Box>
  );
}

function LoadingCard() {
  return (
    <Stack spacing={4} data-react-surface="member" data-route="khatmaRead">
      <SurfaceCard>
        <Typography color="text.secondary">{strings.common.loading}</Typography>
      </SurfaceCard>
    </Stack>
  );
}

function NoPagesView({ khatmaId }: { khatmaId: string }) {
  return (
    <Stack spacing={4} data-react-surface="member" data-route="khatmaRead">
      <AppButton
        quiet
        variant="text"
        href={memberHash.khatma(khatmaId)}
        sx={{ alignSelf: 'start' }}
      >
        ‹ {strings.member.back}
      </AppButton>
      <SurfaceCard>
        <Typography color="text.secondary">{strings.reader.noPagesToday}</Typography>
      </SurfaceCard>
    </Stack>
  );
}
