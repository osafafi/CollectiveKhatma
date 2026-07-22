import { Grid, Stack, Typography } from '@mui/material';
import { shallowEqual } from 'react-redux';
import {
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectKhatmas,
  selectKhatmasListener,
  useAppSelector,
} from '@/app/store';
import { ErrorState } from '@/components/feedback';
import {
  KhatmaSeriesArtwork,
  ProgressBar,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import {
  currentChunk,
  isRoundDone,
  khatmaProgress,
  latestReadableChunk,
} from '@/domain/progress';
import { activeSeriesGroups, seriesTitle, type SeriesGroup } from '@/domain/series';
import type { Khatma } from '@/domain/types';
import { memberHash } from '@/app/routing/routes';
import { formatCompletedDate } from './khatma/formatting';
import { MemberHero } from './MemberHero';
import { useMemberIdentity } from './memberIdentityContext';

/** Member `#/khatmas`: greeting hero + one actionable row-card per active series. */
export function KhatmasListPage() {
  const { memberId } = useMemberIdentity();
  const khatmas = useAppSelector(selectKhatmas);
  const listener = useAppSelector(selectKhatmasListener);
  const mine = khatmas.filter(
    (khatma) => khatma.status === 'active' && khatma.memberIds.includes(memberId),
  );
  const groups = activeSeriesGroups(mine);
  const completed = khatmas
    .filter(
      (khatma) => khatma.status === 'completed' && khatma.memberIds.includes(memberId),
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const assignmentError = useAppSelector((state) => {
    for (const khatma of mine) {
      const current = selectAssignmentsListener(state, khatma.id);
      if (current?.status === 'error') return current.error;
    }
    return null;
  });

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
        {groups.length > 0 ? (
          <Typography
            variant="body2"
            color="primary.main"
            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {toArabicDigits(groups.length)} {strings.member.activeCountWord}
          </Typography>
        ) : null}
      </Stack>

      {listener.status === 'error' || assignmentError ? (
        <ErrorState message={strings.member.connectionError} />
      ) : groups.length === 0 ? (
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
        </Grid>
      )}

      {completed.length > 0 ? (
        <>
          <Typography component="h2" variant="h3" color="text.secondary">
            {strings.member.previousHeading}
          </Typography>
          <Grid container spacing={4}>
            {completed.map((khatma, index) => (
              <Grid key={khatma.id} size={{ xs: 12, md: 6 }}>
                <CompletedKhatmaCard khatma={khatma} appear={index} />
              </Grid>
            ))}
          </Grid>
        </>
      ) : null}
    </Stack>
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
  const title = seriesTitle(khatma, toArabicDigits);
  const percent = `${toArabicDigits(progress.percent)}٪`;

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

/** The design's "previous" row: completed khatmas the member took part in. */
function CompletedKhatmaCard({ khatma, appear }: { khatma: Khatma; appear: number }) {
  const title = seriesTitle(khatma, toArabicDigits);
  return (
    <SurfaceCard
      href={memberHash.khatma(khatma.id)}
      linkLabel={`${strings.member.openKhatma}: ${title}`}
      appear={appear}
      sx={{ height: '100%', opacity: 0.88 }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={khatma.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={52}
        />
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography component="h3" variant="subtitle1">
              {title}
            </Typography>
            <StatusChip tone="accent" label={strings.admin.statusCompleted} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {strings.member.completedOn} {formatCompletedDate(khatma.completedAt)}
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
  return `${toArabicDigits(count)} ${word}`;
}
