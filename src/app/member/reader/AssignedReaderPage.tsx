import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { selectAssignmentsForKhatma, selectKhatmas, useAppSelector } from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import { memberHash } from '@/app/routing/routes';
import {
  AppButton,
  KhatmaSeriesArtwork,
  NoticeBanner,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { personAvatar } from '@/domain/personAppearance';
import { isRoundDone, latestReadableChunk } from '@/domain/progress';
import { seriesTitle } from '@/domain/series';
import type { RoundChunk } from '@/domain/types';
import { useMemberIdentity } from '../memberIdentityContext';
import {
  QuranPageContent,
  ReaderBackground,
  ReaderNav,
  StickyChrome,
} from './readerParts';
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
      memberName={member?.name ?? ''}
      memberAvatar={member ? personAvatar(member) : ''}
      khatmaTitle={seriesTitle(khatma, toArabicDigits)}
      imageName={khatma.imageName}
      chunk={chunk}
      storedDone={mine ? isRoundDone(mine, chunk.round) : false}
    />
  );
}

function AssignedReaderCore({
  khatmaId,
  memberId,
  memberName,
  memberAvatar,
  khatmaTitle,
  imageName,
  chunk,
  storedDone,
}: {
  khatmaId: string;
  memberId: string;
  memberName: string;
  memberAvatar: string;
  khatmaTitle: string;
  imageName: string | undefined;
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

  const indicator = `${strings.reader.page} ${toArabicDigits(page)}`;
  const progressIndicator = `${toArabicDigits(index + 1)} ${strings.reader.of} ${toArabicDigits(pages.length)}`;

  return (
    <Stack spacing={4} data-react-surface="member" data-route="khatmaRead">
      <ReaderBackground />
      <AssignedReaderHeader
        memberName={memberName}
        memberAvatar={memberAvatar}
        khatmaTitle={khatmaTitle}
        imageName={imageName}
        pageCount={pages.length}
      />
      <QuranPageContent page={page} />
      <StickyChrome>
        <ReaderNav
          onPrev={() => go(index - 1)}
          onNext={() => go(index + 1)}
          atStart={index === 0}
          atEnd={index === pages.length - 1}
          indicator={indicator}
          progressIndicator={progressIndicator}
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

function AssignedReaderHeader({
  memberName,
  memberAvatar,
  khatmaTitle,
  imageName,
  pageCount,
}: {
  memberName: string;
  memberAvatar: string;
  khatmaTitle: string;
  imageName: string | undefined;
  pageCount: number;
}) {
  return (
    <Box
      sx={(theme) => ({
        position: 'relative',
        overflow: 'hidden',
        mx: -4,
        mt: -4,
        px: 4,
        py: 2.5,
        background: theme.custom.heroGrad,
        color: theme.custom.heroInk,
        borderRadius: {
          xs: `0 0 ${theme.custom.radii.hero}px ${theme.custom.radii.hero}px`,
          lg: `${theme.custom.radii.card}px`,
        },
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
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '72px minmax(0, 1fr) 72px',
          gridTemplateRows: '40px auto',
          columnGap: 2,
          rowGap: 0.75,
          alignItems: 'center',
        }}
      >
        <Box
          component="span"
          sx={(theme) => ({
            gridColumn: 1,
            gridRow: 1,
            justifySelf: 'start',
            width: '100%',
            height: 40,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 1,
            borderRadius: `${theme.custom.radii.pill}px`,
            bgcolor: theme.custom.heroPill,
            border: `1px solid ${theme.custom.heroPillBorder}`,
            fontSize: '0.75rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          })}
        >
          {pageCountLabel(pageCount)}
        </Box>
        <Typography
          component="h1"
          variant="h3"
          sx={{ gridColumn: 2, gridRow: 1, textAlign: 'center', color: 'inherit' }}
        >
          {strings.reader.assignedTitle}
        </Typography>
        <Stack
          spacing={0.75}
          sx={{
            gridColumn: 3,
            gridRow: '1 / span 2',
            justifySelf: 'center',
            alignSelf: 'start',
            alignItems: 'center',
            minWidth: 0,
            width: '100%',
          }}
        >
          <KhatmaSeriesArtwork
            variant="avatar"
            imageName={imageName}
            alt={strings.admin.seriesImageAlt}
            size={40}
          />
          <Typography
            variant="caption"
            sx={{
              width: '100%',
              textAlign: 'center',
              opacity: 0.82,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {khatmaTitle}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            gridColumn: 2,
            gridRow: 2,
            minWidth: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            component="span"
            variant="body1"
            sx={{
              minWidth: 0,
              maxWidth: 160,
              opacity: 0.85,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {memberName} {memberAvatar}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function pageCountLabel(count: number): string {
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  return `${toArabicDigits(count)} ${word}`;
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
