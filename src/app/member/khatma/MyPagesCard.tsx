import { useState } from 'react';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { Box, Typography } from '@mui/material';
import { CollapsibleCard, StatusChip } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { formatPageRanges, toWesternDigits } from '@/content/quran/symbols';
import { completedReadingLog } from '@/domain/progress';
import type { Assignment } from '@/domain/types';
import { pagesCount } from './formatting';

/** The member's own completed pages in this khatma, one row per round. */
export function MyPagesCard({ assignment }: { assignment: Assignment }) {
  // Local disclosure — collapsed by default so the landing stays short.
  const [open, setOpen] = useState(false);
  const entries = completedReadingLog([assignment]);
  const total = entries.reduce((sum, entry) => sum + entry.pages.length, 0);

  return (
    <CollapsibleCard
      title={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}
        >
          <TaskAltRoundedIcon color="primary" fontSize="small" />
          <Box component="span">{strings.member.myPagesHeading}</Box>
        </Box>
      }
      open={open}
      onOpenChange={setOpen}
      appear={1}
      summaryEnd={<StatusChip tone="primary" label={pagesCount(total)} />}
    >
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {strings.member.myPagesEmpty}
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-label={strings.member.myPagesHeading}
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {entries.map((entry, index) => (
            <Box
              component="li"
              key={`${entry.round}:${index}`}
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
                {strings.member.roundWord} {toWesternDigits(entry.round)}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatPageRanges(entry.pages)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </CollapsibleCard>
  );
}
