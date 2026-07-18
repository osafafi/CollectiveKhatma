import { Box, Divider, Stack, Typography } from '@mui/material';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { seriesTitle } from '@/domain/series';
import type { Khatma } from '@/domain/types';
import { formatCompletedDate } from './formatting';

export function HistoryCard({ khatmas }: { khatmas: readonly Khatma[] }) {
  return (
    <SurfaceCard title={strings.member.historyHeading}>
      <Stack divider={<Divider flexItem />}>
        {khatmas.map((khatma) => (
          <Box key={khatma.id} sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {seriesTitle(khatma, toArabicDigits)} · {strings.member.completedOn}{' '}
              {formatCompletedDate(khatma.completedAt)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </SurfaceCard>
  );
}
