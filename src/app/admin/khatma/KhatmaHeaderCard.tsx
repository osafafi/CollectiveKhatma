import { Box, Stack, Typography } from '@mui/material';
import { DonutChart, QuranPageGrid } from '@/components/charts';
import {
  KhatmaSeriesArtwork,
  ProgressBar,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { khatmaProgress } from '@/domain/progress';
import { seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person } from '@/domain/types';

interface KhatmaHeaderCardProps {
  khatma: Khatma;
  assignments: readonly Assignment[];
  roster: readonly Person[];
}

/** Overview for one khatma: identity, state, progress, and page ownership. */
export function KhatmaHeaderCard({ khatma, assignments, roster }: KhatmaHeaderCardProps) {
  const percent =
    khatma.status === 'completed' ? 100 : khatmaProgress(khatma, assignments).percent;
  const title = seriesTitle(khatma, toArabicDigits);
  const facts =
    `${toArabicDigits(khatma.remainingPages.length)} ${strings.admin.pagesRemaining}` +
    ` · ${strings.admin.roundWord} ${toArabicDigits(khatma.roundCount)}` +
    (khatma.lastDistributionDate
      ? ` · ${strings.admin.lastDistribution}: ${khatma.lastDistributionDate}`
      : '');

  return (
    <SurfaceCard>
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={3}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <KhatmaSeriesArtwork
            variant="avatar"
            imageName={khatma.imageName}
            alt={strings.admin.seriesImageAlt}
            size={88}
          />
          <DonutChart percent={percent} size={88} />
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" variant="h2" color="primary.main">
              {title}
            </Typography>
            <Box>
              <StatusChip
                size="small"
                tone={khatma.status === 'active' ? 'primary' : 'neutral'}
                label={
                  khatma.status === 'active'
                    ? strings.admin.statusActive
                    : strings.admin.statusCompleted
                }
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {facts}
            </Typography>
          </Stack>
        </Stack>
        <ProgressBar value={percent} label={title} />
        <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />
      </Stack>
    </SurfaceCard>
  );
}
