import { useState } from 'react';
import { Grid, Stack, Typography } from '@mui/material';
import { shallowEqual } from 'react-redux';
import {
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectKhatmas,
  selectKhatmasListener,
  selectRoster,
  selectWirdCompletions,
  useAppSelector,
} from '@/app/store';
import { ErrorState } from '@/components/feedback';
import {
  KhatmaSeriesArtwork,
  CollapsibleCard,
  ProgressBar,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import {
  currentChunk,
  isRoundDone,
  khatmaProgress,
  latestReadableChunk,
} from '@/domain/progress';
import { activeSeriesGroups, seriesTitle, type SeriesGroup } from '@/domain/series';
import type { Khatma } from '@/domain/types';
import { isKhatma, isWird, memberBelongsToWird, wirdCompletedOn } from '@/domain/wird';
import { useLocalDate } from './useLocalDate';
import { memberHash } from '@/app/routing/routes';
import { formatCompletedDate } from './khatma/formatting';
import { MemberHero } from './MemberHero';
import { useMemberIdentity } from './memberIdentityContext';

/** Member `#/khatmas`: greeting hero + one actionable row-card per active series. */
export function KhatmasListPage() {
  const [completedOpen, setCompletedOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const { memberId } = useMemberIdentity();
  const today = useLocalDate();
  const khatmas = useAppSelector(selectKhatmas);
  const roster = useAppSelector(selectRoster);
  const listener = useAppSelector(selectKhatmasListener);
  const mine = khatmas.filter(
    (khatma) =>
      isKhatma(khatma) &&
      khatma.status === 'active' &&
      khatma.memberIds.includes(memberId),
  );
  const groups = activeSeriesGroups(mine);
  const activeWirds = khatmas.filter(
    (series) =>
      isWird(series) && series.status === 'active' && series.memberIds.includes(memberId),
  );
  const completed = khatmas
    .filter(
      (khatma) =>
        isKhatma(khatma) &&
        khatma.status === 'completed' &&
        khatma.memberIds.includes(memberId),
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const assignmentError = useAppSelector((state) => {
    for (const khatma of mine) {
      const current = selectAssignmentsListener(state, khatma.id);
      if (current?.status === 'error') return current.error;
    }
    return null;
  });
  const archivedWirds = khatmas
    .filter(
      (series) =>
        isWird(series) &&
        series.status === 'archived' &&
        memberBelongsToWird(series, memberId),
    )
    .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));
  const activeCount = groups.length + activeWirds.length;

  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="member"
      data-route="khatmas"
    >
      <MemberHero />

      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Typography component="h1" variant="h3" color="text.primary">
          {strings.member.khatmasHeading}
        </Typography>
        {activeCount > 0 ? (
          <Typography
            variant="body2"
            color="primary.main"
            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {toWesternDigits(activeCount)} {strings.member.activeCountWord}
          </Typography>
        ) : null}
      </Stack>

      {listener.status === 'error' || assignmentError ? (
        <ErrorState message={strings.member.connectionError} />
      ) : activeCount === 0 ? (
        // Preserve the baseline quirk: this empty card also appears before the
        // global khatma listener's first snapshot; there is no list spinner.
        <SurfaceCard>
          <Typography color="text.secondary">{strings.member.noKhatmas}</Typography>
        </SurfaceCard>
      ) : (
        <Grid container spacing={4}>
          {groups.map((group, index) => (
            <Grid key={group.seriesId} size={{ xs: 12, md: 6 }}>
              <KhatmaSeriesCard group={group} memberId={memberId} appear={index} />
            </Grid>
          ))}
          {activeWirds.map((wird, index) => (
            <Grid key={wird.id} size={{ xs: 12, md: 6 }}>
              <WirdSeriesCard
                wird={wird}
                memberId={memberId}
                today={today}
                appear={groups.length + index}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {completed.length > 0 ? (
        <CollapsibleCard
          title={strings.member.previousHeading}
          headingComponent="h2"
          open={completedOpen}
          onOpenChange={setCompletedOpen}
          summaryEnd={
            <Typography component="span" variant="body2" color="text.secondary">
              {toWesternDigits(completed.length)}
            </Typography>
          }
        >
          <Grid container spacing={4}>
            {completed.map((khatma, index) => (
              <Grid key={khatma.id} size={{ xs: 12, md: 6 }}>
                <CompletedKhatmaCard
                  khatma={khatma}
                  reciterName={
                    roster.find((person) => person.id === khatma.duaReciterId)?.name ??
                    strings.admin.none
                  }
                  appear={index}
                />
              </Grid>
            ))}
          </Grid>
        </CollapsibleCard>
      ) : null}

      {archivedWirds.length > 0 ? (
        <CollapsibleCard
          title={strings.member.wirdArchivedHeading}
          headingComponent="h2"
          open={archivedOpen}
          onOpenChange={setArchivedOpen}
          summaryEnd={
            <Typography component="span" variant="body2" color="text.secondary">
              {toWesternDigits(archivedWirds.length)}
            </Typography>
          }
        >
          <Grid container spacing={4}>
            {archivedWirds.map((wird, index) => (
              <Grid key={wird.id} size={{ xs: 12, md: 6 }}>
                <ArchivedWirdCard wird={wird} appear={index} />
              </Grid>
            ))}
          </Grid>
        </CollapsibleCard>
      ) : null}
    </Stack>
  );
}

function WirdSeriesCard({
  wird,
  memberId,
  today,
  appear,
}: {
  wird: Khatma;
  memberId: string;
  today: string;
  appear: number;
}) {
  const completions = useAppSelector((state) => selectWirdCompletions(state, wird.id));
  const done = wirdCompletedOn(completions, memberId, today);
  const title = seriesTitle(wird, toWesternDigits);
  const content =
    wird.scope.kind === 'dua'
      ? strings.admin.wirdCustomDua
      : pagesCount(wird.remainingPages.length);
  return (
    <SurfaceCard
      href={memberHash.khatma(wird.id)}
      linkLabel={`${strings.member.openWird}: ${title}`}
      appear={appear}
      tone="gold"
      sx={{ height: '100%' }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={wird.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={62}
        />
        <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            <StatusChip tone="accent" label={strings.member.wirdBadge} />
          </Stack>
          <Typography variant="body2">{content}</Typography>
          <Typography
            variant="body2"
            sx={(theme) => ({
              fontWeight: 700,
              color: done ? theme.palette.success.main : theme.custom.goldInk,
            })}
          >
            {done ? `✓ ${strings.member.wirdDoneToday}` : strings.member.wirdPendingToday}
          </Typography>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

function ArchivedWirdCard({ wird, appear }: { wird: Khatma; appear: number }) {
  const title = seriesTitle(wird, toWesternDigits);
  return (
    <SurfaceCard appear={appear} sx={{ height: '100%', opacity: 0.88 }}>
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={wird.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={52}
        />
        <Stack spacing={1}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <StatusChip tone="accent" label={strings.member.wirdBadge} />
          <Typography variant="body2" color="text.secondary">
            {strings.member.wirdDaysCompleted}:{' '}
            {toWesternDigits(wird.completionCount ?? 0)}
          </Typography>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

function KhatmaSeriesCard({
  group,
  memberId,
  appear,
}: {
  group: SeriesGroup;
  memberId: string;
  appear: number;
}) {
  const assignments = useAppSelector(
    (state) => group.active.map((khatma) => selectAssignmentsForKhatma(state, khatma.id)),
    shallowEqual,
  );
  const pendingIndex = group.active.findIndex((_, index) => {
    const mine = assignments[index]?.find(
      (assignment) => assignment.memberId === memberId,
    );
    return mine ? currentChunk(mine) !== undefined : false;
  });
  const targetIndex = pendingIndex >= 0 ? pendingIndex : group.active.length - 1;
  const khatma = group.active[targetIndex] ?? group.latest;
  const targetAssignments = assignments[targetIndex] ?? [];
  const mine = targetAssignments.find((assignment) => assignment.memberId === memberId);
  const progress = khatmaProgress(khatma, targetAssignments);
  const title = seriesTitle(khatma, toWesternDigits);
  const percent = `${toWesternDigits(progress.percent)}٪`;

  return (
    <SurfaceCard
      href={memberHash.khatma(khatma.id)}
      linkLabel={`${strings.member.openKhatma}: ${title}`}
      appear={appear}
      sx={{ height: '100%' }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={khatma.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={62}
        />
        <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            <StatusChip tone="primary" label={strings.admin.statusActive} />
          </Stack>
          <MemberProgressLine assignment={mine} />
          <ProgressBar
            value={progress.percent}
            label={`${strings.member.groupProgress}: ${title}`}
            valueText={percent}
          />
          <Typography variant="caption" color="text.secondary">
            {strings.member.groupProgress} {percent}
          </Typography>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

/** Read-only summary of one completed khatma the member took part in. */
function CompletedKhatmaCard({
  khatma,
  reciterName,
  appear,
}: {
  khatma: Khatma;
  reciterName: string;
  appear: number;
}) {
  const title = seriesTitle(khatma, toWesternDigits);
  return (
    <SurfaceCard appear={appear} sx={{ height: '100%', opacity: 0.88 }}>
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={khatma.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={52}
        />
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {strings.member.completedOn} {formatCompletedDate(khatma.completedAt)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {strings.member.du3aReciterLabel}: {reciterName}
          </Typography>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

function MemberProgressLine({
  assignment,
}: {
  assignment: ReturnType<typeof selectAssignmentsForKhatma>[number] | undefined;
}) {
  const chunk = assignment ? latestReadableChunk(assignment) : undefined;
  if (!assignment || !chunk) {
    return (
      <Typography variant="body2" color="text.secondary">
        {strings.member.awaitingDistribution}
      </Typography>
    );
  }

  if (isRoundDone(assignment, chunk.round)) {
    return (
      <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
        ✓ {strings.member.doneToday}
      </Typography>
    );
  }

  return (
    <Typography variant="body2">
      {strings.member.todayHeading}:{' '}
      <Typography
        component="span"
        variant="body2"
        sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {pagesCount(chunk.pages.length)}
      </Typography>
    </Typography>
  );
}

function pagesCount(count: number): string {
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  return `${toWesternDigits(count)} ${word}`;
}
