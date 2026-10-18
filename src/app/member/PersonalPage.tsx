import { shallowEqual } from 'react-redux';
import { FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useWriteOperation } from '@/app/operations';
import {
  selectAssignmentByMemberId,
  selectKhatmas,
  selectRoster,
  useAppSelector,
  useAssignmentsSubscription,
  selectWirdCompletions,
  useWirdCompletionsSubscription,
} from '@/app/store';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { memberReadingInsights } from '@/domain/progress';
import type { Assignment } from '@/domain/types';
import { isKhatma, isWird, memberBelongsToWird } from '@/domain/wird';
import { MemberHero } from './MemberHero';
import { MemberIdentitySummary } from './MemberIdentitySummary';
import { PendingAssignmentsCard } from './PendingAssignmentsCard';
import { PersonalReadingInsights } from './PersonalReadingInsights';
import { useMemberIdentity } from './memberIdentityContext';

/** Selected-member identity plus Quran completion and reading-history insights. */
export function PersonalPage() {
  const { memberId, member } = useMemberIdentity();
  const roster = useAppSelector(selectRoster);
  const khatmas = useAppSelector(selectKhatmas);
  const assignments = useAppSelector(
    (state) =>
      khatmas
        .filter((khatma) => isKhatma(khatma) && khatma.memberIds.includes(memberId))
        .map((khatma) => selectAssignmentByMemberId(state, khatma.id, memberId))
        .filter((assignment): assignment is Assignment => assignment !== undefined),
    shallowEqual,
  );
  const wirdCompletions = useAppSelector(
    (state) =>
      khatmas
        .filter((series) => isWird(series) && memberBelongsToWird(series, memberId))
        .flatMap((series) => selectWirdCompletions(state, series.id)),
    shallowEqual,
  );
  const insights = memberReadingInsights({
    memberId,
    roster,
    khatmas,
    assignments,
    wirdCompletions,
  });

  return (
    <>
      <CompletedKhatmaAssignmentSubscriptions />
      <HistoricalWirdCompletionSubscriptions />
      <Stack spacing={4}>
        <MemberHero />
        <MemberIdentitySummary />
        <HoldPagesCard memberId={memberId} enabled={member?.holdPages === true} />
        <PendingAssignmentsCard />
        <PersonalReadingInsights insights={insights} />
      </Stack>
    </>
  );
}

function HoldPagesCard({ memberId, enabled }: { memberId: string; enabled: boolean }) {
  const updatePerson = useWriteOperation('updatePerson');

  return (
    <SurfaceCard
      appear={0}
      sx={(theme) => ({
        background: `linear-gradient(135deg, ${alpha(theme.palette.warning.light, 0.18)}, ${alpha(theme.palette.primary.light, 0.12)})`,
        border: `1px solid ${alpha(theme.palette.warning.main, 0.22)}`,
      })}
    >
      <Stack spacing={1.5}>
        <FormControlLabel
          control={
            <Switch
              color="warning"
              checked={enabled}
              disabled={updatePerson.isPending}
              onChange={(_, checked) => {
                void updatePerson.execute(memberId, { holdPages: checked });
              }}
              slotProps={{ input: { 'aria-label': strings.personal.holdPages } }}
            />
          }
          label={
            <Typography component="span" sx={{ fontWeight: 800 }}>
              {strings.personal.holdPages}
            </Typography>
          }
          sx={{ m: 0, justifyContent: 'space-between', flexDirection: 'row-reverse' }}
        />
        {enabled ? (
          <Typography variant="caption" color="warning.dark" sx={{ fontWeight: 700 }}>
            {strings.personal.holdPagesHint}
          </Typography>
        ) : null}
        {updatePerson.state.status === 'failure' ? (
          <Typography role="alert" variant="caption" color="error.main">
            {strings.personal.holdPagesSaveError}
          </Typography>
        ) : null}
      </Stack>
    </SurfaceCard>
  );
}

/** Retain historical assignment data only while the personal insights are visible. */
function CompletedKhatmaAssignmentSubscriptions() {
  const { memberId } = useMemberIdentity();
  const khatmaIds = useAppSelector(
    (state) =>
      selectKhatmas(state)
        .filter(
          (khatma) =>
            isKhatma(khatma) &&
            khatma.status === 'completed' &&
            khatma.memberIds.includes(memberId),
        )
        .map((khatma) => khatma.id),
    shallowEqual,
  );

  return khatmaIds.map((khatmaId) => (
    <CompletedKhatmaAssignmentSubscription key={khatmaId} khatmaId={khatmaId} />
  ));
}

function HistoricalWirdCompletionSubscriptions() {
  const { memberId } = useMemberIdentity();
  const ids = useAppSelector(
    (state) =>
      selectKhatmas(state)
        .filter((series) => isWird(series) && memberBelongsToWird(series, memberId))
        .map((series) => series.id),
    shallowEqual,
  );
  return ids.map((id) => <HistoricalWirdSubscription key={id} id={id} />);
}

function HistoricalWirdSubscription({ id }: { id: string }) {
  useWirdCompletionsSubscription(id);
  return null;
}

function CompletedKhatmaAssignmentSubscription({ khatmaId }: { khatmaId: string }) {
  useAssignmentsSubscription(khatmaId);
  return null;
}
