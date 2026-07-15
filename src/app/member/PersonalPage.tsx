import { Stack, Typography } from '@mui/material';
import { ProgressBar, SurfaceCard, formatPercent } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { lifetimePercent } from '@/domain/progress';
import { MemberIdentitySummary } from './MemberIdentitySummary';
import { useMemberIdentity } from './memberIdentityContext';

/** Selected-member identity plus lifetime Quran-reading insight. */
export function PersonalPage() {
  const { member } = useMemberIdentity();
  const completedPageCount = member?.completedPages.length ?? 0;
  const percent = lifetimePercent(completedPageCount);
  const percentText = formatPercent(percent);
  const insightText = `${strings.member.lifetimeLead} ${toArabicDigits(completedPageCount)} ${strings.member.lifetimeTail} (${percentText})`;

  return (
    <Stack spacing={4}>
      <MemberIdentitySummary />
      <SurfaceCard title={strings.member.lifetimeLead}>
        <Stack spacing={2}>
          <Typography component="p" variant="body1">
            {insightText}
          </Typography>
          <ProgressBar
            value={percent}
            label={strings.member.lifetimeLead}
            valueText={percentText}
          />
        </Stack>
      </SurfaceCard>
    </Stack>
  );
}
