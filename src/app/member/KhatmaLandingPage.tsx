import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectKhatmas,
  selectKhatmasListener,
  selectRoster,
  useAppSelector,
} from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import { memberHash } from '@/app/routing/routes';
import { ErrorState } from '@/components/feedback';
import {
  AppButton,
  NoticeBanner,
  ProgressView,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { ReleasedChunkError } from '@/data/assignments';
import { warningLevel } from '@/domain/distribution';
import {
  isRoundDone,
  khatmaProgress,
  latestReadableChunk,
  pendingReaders,
} from '@/domain/progress';
import { completedInSeries, seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import { useMemberIdentity } from './memberIdentityContext';
import { QuranPageGrid } from '@/components/charts';

/** Member `#/khatma/{id}` landing page. */
export function KhatmaLandingPage({ khatmaId }: { khatmaId: string }) {
  const { memberId, member } = useMemberIdentity();
  const khatmas = useAppSelector(selectKhatmas);
  const khatmasListener = useAppSelector(selectKhatmasListener);
  const khatma = khatmas.find(
    (candidate) => candidate.id === khatmaId && candidate.memberIds.includes(memberId),
  );
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatma?.id ?? khatmaId),
  );
  const assignmentsListener = useAppSelector((state) =>
    selectAssignmentsListener(state, khatma?.id ?? khatmaId),
  );
  const roster = useAppSelector(selectRoster);

  if (khatmasListener.status === 'error') {
    return <LandingFeedback kind="error" />;
  }

  // Exact baseline behavior: an empty khatma collection is treated as loading,
  // including before the first listener snapshot.
  if (khatmas.length === 0) {
    return <LandingFeedback kind="loading" />;
  }

  if (!khatma) {
    return <LandingFeedback kind="not-found" />;
  }

  if (assignmentsListener?.status === 'error') {
    return <LandingFeedback kind="error" />;
  }

  return (
    <KhatmaLandingContent
      khatma={khatma}
      allKhatmas={khatmas}
      assignments={assignments}
      roster={roster}
      memberId={memberId}
      paused={member ? !member.enabled : false}
    />
  );
}

function LandingFeedback({ kind }: { kind: 'loading' | 'not-found' | 'error' }) {
  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="member"
      data-route="khatma"
    >
      {kind === 'loading' ? null : (
        <AppButton
          quiet
          variant="text"
          href={memberHash.khatmas()}
          sx={{ alignSelf: 'start' }}
        >
          {strings.member.khatmasHeading}
        </AppButton>
      )}
      {kind === 'error' ? (
        <ErrorState message={strings.member.connectionError} />
      ) : (
        <SurfaceCard>
          <Typography color="text.secondary">
            {kind === 'loading' ? strings.common.loading : strings.member.noKhatmas}
          </Typography>
        </SurfaceCard>
      )}
    </Stack>
  );
}

function KhatmaLandingContent({
  khatma,
  allKhatmas,
  assignments,
  roster,
  memberId,
  paused,
}: {
  khatma: Khatma;
  allKhatmas: readonly Khatma[];
  assignments: readonly Assignment[];
  roster: readonly Person[];
  memberId: string;
  paused: boolean;
}) {
  const mine = assignments.find((assignment) => assignment.memberId === memberId);
  const warning = mine ? warningLevel(mine.missedStreak) : 'none';
  const history = completedInSeries(allKhatmas, khatma.seriesId);

  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="member"
      data-route="khatma"
    >
      <AppButton
        quiet
        variant="text"
        href={memberHash.khatmas()}
        sx={{ alignSelf: 'start' }}
      >
        {strings.member.khatmasHeading}
      </AppButton>

      <Typography component="h1" variant="h2" color="primary.main">
        {seriesTitle(khatma, toArabicDigits)}
      </Typography>
      <RoundLine khatma={khatma} />

      {warning !== 'none' ? (
        <NoticeBanner tone={warning === 'red' ? 'danger' : 'warning'}>
          ⚠ {strings.member.warningNote}
        </NoticeBanner>
      ) : null}

      {paused ? (
        <NoticeBanner tone="primary" sx={{ textAlign: 'center' }}>
          {strings.member.pausedNote}
        </NoticeBanner>
      ) : mine ? (
        <MyRoundCard khatma={khatma} assignment={mine} memberId={memberId} />
      ) : null}

      <GroupProgressCard khatma={khatma} assignments={assignments} roster={roster} />

      {history.length > 0 ? <HistoryCard khatmas={history} /> : null}
    </Stack>
  );
}

function RoundLine({ khatma }: { khatma: Khatma }) {
  const started = new Date(khatma.createdAt).toISOString().slice(0, 10);
  return (
    <Stack
      direction="row"
      spacing={3}
      sx={{ justifyContent: 'space-between', color: 'text.secondary' }}
    >
      <Typography>
        {strings.member.roundWord} {toArabicDigits(Math.max(1, khatma.roundCount))}
      </Typography>
      <Typography>
        {strings.member.startedWord} {started}
      </Typography>
    </Stack>
  );
}

function MyRoundCard({
  khatma,
  assignment,
  memberId,
}: {
  khatma: Khatma;
  assignment: Assignment;
  memberId: string;
}) {
  const chunk = latestReadableChunk(assignment);
  if (!chunk) {
    return (
      <SurfaceCard title={strings.member.todayHeading}>
        <Typography color="text.secondary">
          {strings.member.awaitingDistribution}
        </Typography>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard title={strings.member.todayHeading}>
      <PagesRow pages={chunk.pages} />
      <RoundActions
        key={`${khatma.id}:${chunk.round}`}
        khatmaId={khatma.id}
        memberId={memberId}
        chunk={chunk}
        storedDone={isRoundDone(assignment, chunk.round)}
      />
    </SurfaceCard>
  );
}

function PagesRow({ pages }: { pages: readonly number[] }) {
  return (
    <Stack spacing={2}>
      <Typography sx={{ fontWeight: 600 }}>{pagesCount(pages.length)}</Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {pages.map((page) => (
          <Chip
            key={page}
            label={toArabicDigits(page)}
            sx={{ bgcolor: 'background.default', fontSize: '1.125rem' }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function RoundActions({
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
  const markDone = useWriteOperation('markRoundDone');
  const done = storedDone || markDone.state.status === 'success';

  if (done) {
    return (
      <NoticeBanner tone="success" sx={{ textAlign: 'center', fontWeight: 600 }}>
        ✓ {strings.member.doneToday}
      </NoticeBanner>
    );
  }

  const error =
    markDone.state.status === 'failure'
      ? markDone.state.error instanceof ReleasedChunkError
        ? strings.member.releasedNote
        : strings.member.saveError
      : null;

  return (
    <Stack spacing={2}>
      <AppButton href={memberHash.khatmaRead(khatmaId)}>
        {strings.reader.readMyPages}
      </AppButton>
      <AppButton
        hero
        disabled={markDone.isPending}
        onClick={() => {
          void markDone.execute(khatmaId, memberId, chunk.round);
        }}
      >
        {strings.member.finishedToday}
      </AppButton>
      {error ? (
        <Typography role="alert" color="error.main" sx={{ textAlign: 'center' }}>
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
}

function GroupProgressCard({
  khatma,
  assignments,
  roster,
}: {
  khatma: Khatma;
  assignments: readonly Assignment[];
  roster: readonly Person[];
}) {
  const progress = khatmaProgress(khatma, assignments);
  const inRound = assignments.filter((assignment) =>
    assignment.rounds.some(
      (chunk) =>
        chunk.round === khatma.roundCount &&
        chunk.pages.length > 0 &&
        chunk.released !== true,
    ),
  );
  const doneCount = inRound.filter((assignment) =>
    isRoundDone(assignment, khatma.roundCount),
  ).length;
  const pendingNames = pendingReaders(assignments)
    .map((id) => roster.find((person) => person.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const percent = `${toArabicDigits(progress.percent)}٪`;

  return (
    <SurfaceCard title={strings.member.groupProgress}>
      <ProgressView
        value={progress.percent}
        label={strings.member.groupProgress}
        valueText={percent}
      />
      {inRound.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          {strings.member.completedRoundCount}: {toArabicDigits(doneCount)}{' '}
          {strings.member.ofWord} {toArabicDigits(inRound.length)}
        </Typography>
      ) : null}
      {pendingNames.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          ⏳ {pendingNames.join('، ')}
        </Typography>
      ) : null}
      <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />

    </SurfaceCard>
  );
}

function HistoryCard({ khatmas }: { khatmas: readonly Khatma[] }) {
  return (
    <SurfaceCard title={strings.member.historyHeading}>
      <Stack divider={<Divider flexItem />}>
        {khatmas.map((khatma) => {
          const completed = khatma.completedAt
            ? new Date(khatma.completedAt).toISOString().slice(0, 10)
            : '—';
          return (
            <Box key={khatma.id} sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {seriesTitle(khatma, toArabicDigits)} · {strings.member.completedOn}{' '}
                {completed}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </SurfaceCard>
  );
}

function pagesCount(count: number): string {
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  return `${toArabicDigits(count)} ${word}`;
}
