import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { CollapsibleCard, StatusChip } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { seriesTitle } from '@/domain/series';
import type { Khatma } from '@/domain/types';
import { formatCompletedDate } from './formatting';

export function HistoryCard({ khatmas }: { khatmas: readonly Khatma[] }) {
  // Local disclosure — the design (2a) keeps series history collapsed.
  const [open, setOpen] = useState(false);
  return (
    <CollapsibleCard
      title={strings.member.historyHeading}
      open={open}
      onOpenChange={setOpen}
      appear={2}
      summaryEnd={<StatusChip tone="primary" label={toArabicDigits(khatmas.length)} />}
    >
      {khatmas.map((khatma) => (
        <Box
          key={khatma.id}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 3,
            py: 2.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {seriesTitle(khatma, toArabicDigits)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {strings.member.completedOn} {formatCompletedDate(khatma.completedAt)}
          </Typography>
        </Box>
      ))}
    </CollapsibleCard>
  );
}
