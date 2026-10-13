import { useState } from 'react';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { Box, Typography } from '@mui/material';
import type { ListenerStatus } from '@/app/store';
import { CollapsibleCard, StatusChip } from '@/components/primitives';
import { formatPageRanges, toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { completedReadingLog } from '@/domain/progress';
import type { Assignment, Person } from '@/domain/types';
import { formatReadingTimestamp } from './formatting';

interface KhatmaReadingLogCardProps {
  assignments: readonly Assignment[];
  roster: readonly Person[];
  /** Assignment listener state; an unloaded collection is never shown as empty. */
  status: ListenerStatus | undefined;
}

/** Who read which pages and when — completed chunks only, newest first. */
export function KhatmaReadingLogCard({
  assignments,
  roster,
  status,
}: KhatmaReadingLogCardProps) {
  // Local disclosure — collapsed by default at the end of the detail page.
  const [open, setOpen] = useState(false);
  const entries = completedReadingLog(assignments);
  const ready = status === 'ready';

  return (
    <CollapsibleCard
      title={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}
        >
          <ReceiptLongRoundedIcon color="primary" fontSize="small" />
          <Box component="span">{strings.admin.readingLogHeading}</Box>
        </Box>
      }
      open={open}
      onOpenChange={setOpen}
      summaryEnd={
        ready ? (
          <StatusChip tone="primary" label={toWesternDigits(entries.length)} />
        ) : undefined
      }
    >
      {status === 'error' ? (
        <Typography variant="body2" color="error">
          {strings.feedback.errorTitle}
        </Typography>
      ) : !ready ? (
        <Typography variant="body2" color="text.secondary">
          {strings.common.loading}
        </Typography>
      ) : entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {strings.admin.readingLogEmpty}
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-label={strings.admin.readingLogHeading}
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {entries.map((entry, index) => (
            <Box
              component="li"
              key={`${entry.memberId}:${entry.round}:${index}`}
              sx={{ py: 2.5, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                {roster.find((person) => person.id === entry.memberId)?.name ??
                  entry.memberId}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  columnGap: 3,
                  mt: 0.5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <Typography component="span" variant="body2">
                  {`${strings.admin.roundWord} ${toWesternDigits(entry.round)} · ${formatPageRanges(entry.pages)}`}
                </Typography>
                {/* Isolated LTR so the date, "@", and AM/PM keep their order in RTL. */}
                <Typography
                  component="bdi"
                  dir="ltr"
                  variant="body2"
                  color="text.secondary"
                >
                  {formatReadingTimestamp(entry.completedAt)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </CollapsibleCard>
  );
}
