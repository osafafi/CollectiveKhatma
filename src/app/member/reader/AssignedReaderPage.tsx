import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectKhatmas,
  selectKhatmasListener,
  useAppSelector,
} from '@/app/store';
import { ReleasedChunkError } from '@/app/operations';
import { useFinishWithDailyDua } from '../useFinishWithDailyDua';
import { memberHash } from '@/app/routing/routes';
import {
  AppButton,
  KhatmaSeriesArtwork,
  NoticeBanner,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import { personAvatar } from '@/domain/personAppearance';
import { isRoundDone, latestReadableChunk } from '@/domain/progress';
import { activeKhatmaIdsInSeries, seriesTitle } from '@/domain/series';
import type { RoundChunk } from '@/domain/types';
import { startMushafPrefetch } from '../install/mushafPrefetch';
import { useMemberIdentity } from '../memberIdentityContext';
import { useOnlineStatus } from '../useOnlineStatus';
import {
  QuranPageContent,
  ReaderBackground,
  ReaderNav,
  StickyChrome,
} from './readerParts';
import { clampIndex, prefetchNeighbors } from './readerPaging';

/**
 * Member assigned reader (`#/khatma/{id}/read`) — the current-round chunk with a
 * one-tap finish action. A khatma list that has not arrived yet reads as
 * loading while one still can, as "could not load" once it cannot, and
 * everything else that is not a readable chunk of mine shows the back +
 * "no pages" view.
 */
export function AssignedReaderPage({ khatmaId }: { khatmaId: string }) {
  const { memberId, member } = useMemberIdentity();
  const khatmas = useAppSelector(selectKhatmas);
  const khatmasListener = useAppSelector(selectKhatmasListener);
  const online = useOnlineStatus();
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatmaId),
  );

  const khatma = khatmas.find(
    (candidate) =>
      candidate.id === khatmaId &&
      candidate.status === 'active' &&
      candidate.memberIds.includes(memberId),
  );

  // Nothing to show yet. Offline that means this device has nothing cached —
  // note that Firestore reports an empty cache as a *ready* empty snapshot, not
  // as pending, so listener status alone cannot tell the two apart — and a
  // failed subscription says the same. Only an empty list that arrived over a
  // live connection is a real answer: this member has no khatma. Reading any of
  // the others as "no pages", or as a spinner that never resolves, is a guess.
  if (khatmas.length === 0) {
    if (!online || khatmasListener.status === 'error') {
      return <ReaderNoticeView khatmaId={khatmaId} message={strings.reader.loadFailed} />;
    }
    if (khatmasListener.status !== 'ready') return <LoadingCard />;
  }
  if (!khatma) return <NoPagesView khatmaId={khatmaId} />;

  const paused = member ? !member.enabled : false;
  const mine = assignments.find((assignment) => assignment.memberId === memberId);
  // The member reads their current round's chunk (revisiting it once done).
  const chunk = mine && !paused ? latestReadableChunk(mine) : undefined;
  if (!chunk || chunk.pages.length === 0) return <NoPagesView khatmaId={khatmaId} />;

  return (
    // Key on the round and page set so a new distribution or same-round
    // redistribution remounts fresh, while unrelated realtime ticks keep this
    // instance — and its page/scroll — alive.
    <AssignedReaderCore
      key={`${khatmaId}:${chunk.round}:${chunk.pages.join(',')}`}
      khatmaId={khatmaId}
      memberId={memberId}
      memberName={member?.name ?? ''}
      memberAvatar={member ? personAvatar(member) : ''}
      khatmaTitle={seriesTitle(khatma, toWesternDigits)}
      imageName={khatma.imageName}
      chunk={chunk}
      storedDone={mine ? isRoundDone(mine, chunk.round) : false}
      activeSeriesKhatmaIds={activeKhatmaIdsInSeries(khatmas, khatma.seriesId)}
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
  activeSeriesKhatmaIds,
}: {
  khatmaId: string;
  memberId: string;
  memberName: string;
  memberAvatar: string;
  khatmaTitle: string;
  imageName: string | undefined;
  chunk: RoundChunk;
  storedDone: boolean;
  activeSeriesKhatmaIds: readonly string[];
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

  // The member's own chunk jumps the queue of the background mushaf sweep, so
  // the pages they were actually assigned are the first ones to survive a
  // lost connection.
  useEffect(() => {
    startMushafPrefetch(pages);
  }, [pages]);

  const indicator = `${strings.reader.page} ${toWesternDigits(page)}`;
  const progressIndicator = `${toWesternDigits(index + 1)} ${strings.reader.of} ${toWesternDigits(pages.length)}`;

  return (
    <Stack spacing={4} data-react-surface="member" data-route="khatmaRead">
      <ReaderBackground />
      <Box>
        <AssignedReaderHeader
          memberName={memberName}
          memberAvatar={memberAvatar}
          khatmaTitle={khatmaTitle}
          imageName={imageName}
          pageCount={pages.length}
        />
        <QuranPageContent page={page} showSurahName />
      </Box>
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
        activeSeriesKhatmaIds={activeSeriesKhatmaIds}
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
  return `${toWesternDigits(count)} ${word}`;
}

function FinishFooter({
  khatmaId,
  memberId,
  round,
  storedDone,
  activeSeriesKhatmaIds,
}: {
  khatmaId: string;
  memberId: string;
  round: number;
  storedDone: boolean;
  activeSeriesKhatmaIds: readonly string[];
}) {
  const finish = useFinishWithDailyDua({
    khatmaId,
    memberId,
    round,
    activeSeriesKhatmaIds,
  });
  const done = storedDone || finish.isDone;

  if (done) {
    return (
      <NoticeBanner tone="success" sx={{ textAlign: 'center', fontWeight: 600 }}>
        ✓ {strings.member.doneToday}
      </NoticeBanner>
    );
  }

  // Kept on this device until the connection returns. Deliberately not the
  // success banner: the group has not been told anything yet.
  if (finish.isQueued) {
    return (
      <NoticeBanner tone="warning" role="status" sx={{ textAlign: 'center' }}>
        {strings.member.queuedFinish}
      </NoticeBanner>
    );
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 4 }}>
      <AppButton hero disabled={finish.isPending} onClick={finish.run}>
        {strings.member.finishedToday}
      </AppButton>
      {finish.error ? (
        <Typography role="alert" color="error.main" sx={{ mt: 2, textAlign: 'center' }}>
          {finish.error instanceof ReleasedChunkError
            ? strings.member.releasedNote
            : strings.member.saveError}
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
  return <ReaderNoticeView khatmaId={khatmaId} message={strings.reader.noPagesToday} />;
}

/** Back link plus one line of copy — every dead end this route can reach. */
function ReaderNoticeView({ khatmaId, message }: { khatmaId: string; message: string }) {
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
        <Typography color="text.secondary">{message}</Typography>
      </SurfaceCard>
    </Stack>
  );
}
