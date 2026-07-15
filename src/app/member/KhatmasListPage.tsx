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
import { ProgressBar, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import {
  currentChunk,
  isRoundDone,
  khatmaProgress,
  latestReadableChunk,
} from '@/domain/progress';
import { activeSeriesGroups, seriesTitle, type SeriesGroup } from '@/domain/series';
import { memberHash } from '@/app/routing/routes';
import { useMemberIdentity } from './memberIdentityContext';

/** Member `#/khatmas`: one actionable card per active series. */
export function KhatmasListPage() {
  const { memberId } = useMemberIdentity();
  const khatmas = useAppSelector(selectKhatmas);
  const listener = useAppSelector(selectKhatmasListener);
  const mine = khatmas.filter(
    (khatma) => khatma.status === 'active' && khatma.memberIds.includes(memberId),
  );
  const groups = activeSeriesGroups(mine);
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
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.member.khatmasHeading}
      </Typography>

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
          {groups.map((group) => (
            <Grid key={group.seriesId} size={{ xs: 12, md: 6 }}>
              <KhatmaSeriesCard group={group} memberId={memberId} />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}

function KhatmaSeriesCard({ group, memberId }: { group: SeriesGroup; memberId: string }) {
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
      sx={{ height: '100%' }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="h2" variant="subtitle1" color="primary.main">
            {title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
          >
            {percent}
          </Typography>
        </Stack>
        <ProgressBar
          value={progress.percent}
          label={`${strings.member.groupProgress}: ${title}`}
          valueText={percent}
        />
        <MemberProgressLine assignment={mine} />
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
      <Typography color="text.secondary">
        {strings.member.awaitingDistribution}
      </Typography>
    );
  }

  if (isRoundDone(assignment, chunk.round)) {
    return (
      <Typography color="success.main" sx={{ fontWeight: 600 }}>
        ✓ {strings.member.doneToday}
      </Typography>
    );
  }

  return (
    <Typography>
      {strings.member.todayHeading}:{' '}
      <Typography
        component="span"
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
