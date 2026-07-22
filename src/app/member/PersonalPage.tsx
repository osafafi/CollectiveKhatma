import { Stack, Typography } from '@mui/material';
import { DonutChart } from '@/components/charts';
import {
  NestedSurface,
  ProgressBar,
  SurfaceCard,
  formatPercent,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { lifetimePercent } from '@/domain/progress';
import { MemberHero } from './MemberHero';
import { MemberIdentitySummary } from './MemberIdentitySummary';
import { useMemberIdentity } from './memberIdentityContext';

/** Selected-member identity plus lifetime Quran-reading insight (mock 2b). */
export function PersonalPage() {
  const { member } = useMemberIdentity();
  const completedPageCount = member?.completedPages.length ?? 0;
  const percent = lifetimePercent(completedPageCount);
  const percentText = formatPercent(percent);
  const insightText = `${strings.member.lifetimeLead} ${toArabicDigits(completedPageCount)} ${strings.member.lifetimeTail} (${percentText})`;

  return (
    <Stack spacing={4}>
      <MemberHero />
      <MemberIdentitySummary />
      <SurfaceCard title={strings.member.lifetimeLead} appear={0}>
        <Stack
          direction="row"
          spacing={4}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <DonutChart percent={percent} size={96} />
          <Stack spacing={2} sx={{ flex: 1, minWidth: 200 }}>
            <Typography component="p" variant="body1">
              {insightText}
            </Typography>
            <ProgressBar
              value={percent}
              label={strings.member.lifetimeLead}
              valueText={percentText}
            />
          </Stack>
        </Stack>
        <NestedSurface sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 3 }}>
          <Typography
            component="span"
            color="primary.main"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {toArabicDigits(completedPageCount)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {strings.member.lifetimeTail}
          </Typography>
        </NestedSurface>
      </SurfaceCard>
    </Stack>
  );
}
