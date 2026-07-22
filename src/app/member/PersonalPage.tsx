import { shallowEqual } from 'react-redux';
import { Box, Paper, Stack, Typography } from '@mui/material';
import {
  selectAssignmentByMemberId,
  selectKhatmas,
  selectRoster,
  useAppSelector,
  useAssignmentsSubscription,
} from '@/app/store';
import { DonutChart } from '@/components/charts';
import { SurfaceCard, formatPercent } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { memberReadingInsights, type MemberReadingInsights } from '@/domain/progress';
import type { Assignment } from '@/domain/types';
import { MemberHero } from './MemberHero';
import { MemberIdentitySummary } from './MemberIdentitySummary';
import { PendingAssignmentsCard } from './PendingAssignmentsCard';
import { useMemberIdentity } from './memberIdentityContext';

/** Selected-member identity plus Quran completion and reading-history insights. */
export function PersonalPage() {
  const { memberId } = useMemberIdentity();
  const roster = useAppSelector(selectRoster);
  const khatmas = useAppSelector(selectKhatmas);
  const assignments = useAppSelector(
    (state) =>
      khatmas
        .filter((khatma) => khatma.memberIds.includes(memberId))
        .map((khatma) => selectAssignmentByMemberId(state, khatma.id, memberId))
        .filter((assignment): assignment is Assignment => assignment !== undefined),
    shallowEqual,
  );
  const insights = memberReadingInsights({
    memberId,
    roster,
    khatmas,
    assignments,
  });

  return (
    <>
      <CompletedKhatmaAssignmentSubscriptions />
      <Stack spacing={4}>
        <MemberHero />
        <MemberIdentitySummary />
        <PendingAssignmentsCard />
        <PersonalReadingInsights insights={insights} />
      </Stack>
    </>
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
            khatma.status === 'completed' && khatma.memberIds.includes(memberId),
        )
        .map((khatma) => khatma.id),
    shallowEqual,
  );

  return khatmaIds.map((khatmaId) => (
    <CompletedKhatmaAssignmentSubscription key={khatmaId} khatmaId={khatmaId} />
  ));
}

function CompletedKhatmaAssignmentSubscription({ khatmaId }: { khatmaId: string }) {
  useAssignmentsSubscription(khatmaId);
  return null;
}

function PersonalReadingInsights({ insights }: { insights: MemberReadingInsights }) {
  const rankText = `${strings.personal.topReadersLead} ${formatPercent(insights.topReaderPercent)} ${strings.personal.topReadersTail}`;

  return (
    <SurfaceCard title={strings.personal.quranCompletionHeading} appear={0}>
      <Stack
        direction="row"
        spacing={{ xs: 2, sm: 4 }}
        sx={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <DonutChart
          percent={insights.quranPercent}
          size={132}
          caption={strings.personal.quranDonutCaption}
        />
        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
          >
            <Typography
              component="span"
              color="text.primary"
              sx={{
                fontSize: { xs: '2rem', sm: '2.75rem' },
                fontWeight: 800,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {toArabicDigits(insights.completedPageCount)}
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary">
              {strings.personal.quranPageTotal}
            </Typography>
          </Stack>
          <Typography component="p" variant="body2" color="text.secondary">
            {rankText}
          </Typography>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <ReadingStat
          value={insights.completedKhatmas}
          label={strings.personal.completedKhatmas}
        />
        <ReadingStat
          value={insights.pagesReadThisMonth}
          label={strings.personal.pagesThisMonth}
          tone="gold"
        />
        <ReadingStat
          value={insights.longestDailyStreak}
          label={strings.personal.longestDailyStreak}
        />
      </Box>
    </SurfaceCard>
  );
}

function ReadingStat({
  value,
  label,
  tone = 'primary',
}: {
  value: number;
  label: string;
  tone?: 'primary' | 'gold';
}) {
  return (
    <Paper
      component="section"
      aria-label={label}
      elevation={0}
      sx={(theme) => ({
        minHeight: { xs: 132, sm: 148 },
        p: { xs: 2, sm: 3 },
        borderRadius: `${theme.custom.radii.card}px`,
        background: theme.custom.cardBg,
        boxShadow: theme.custom.cardShadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        textAlign: 'center',
      })}
    >
      <Typography
        component="p"
        sx={(theme) => ({
          color: tone === 'gold' ? theme.custom.goldInk : theme.palette.primary.main,
          fontSize: { xs: '1.75rem', sm: '2rem' },
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        })}
      >
        {toArabicDigits(value)}
      </Typography>
      <Typography component="p" variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}
