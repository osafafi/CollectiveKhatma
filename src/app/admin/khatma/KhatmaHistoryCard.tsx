import { useState } from 'react';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { Box, Stack, Typography } from '@mui/material';
import { CollapsibleCard, StatusChip } from '@/components/primitives';
import { toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { completedInSeries, seriesTitle } from '@/domain/series';
import type { Khatma, Person } from '@/domain/types';

interface KhatmaHistoryCardProps {
  khatma: Khatma;
  khatmas: readonly Khatma[];
  roster: readonly Person[];
}

/** Completed khatmas in the current series and their dua reciters. */
export function KhatmaHistoryCard({ khatma, khatmas, roster }: KhatmaHistoryCardProps) {
  // Local disclosure — collapsed by default as the last card of the detail page.
  const [open, setOpen] = useState(false);
  const history = completedInSeries(khatmas, khatma.seriesId).filter(
    (other) => other.id !== khatma.id,
  );
  const lines = khatma.status === 'completed' ? [khatma, ...history] : history;

  return (
    <CollapsibleCard
      title={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}
        >
          <HistoryRoundedIcon color="primary" fontSize="small" />
          <Box component="span">{strings.admin.historyHeading}</Box>
        </Box>
      }
      open={open}
      onOpenChange={setOpen}
      summaryEnd={<StatusChip tone="primary" label={toWesternDigits(lines.length)} />}
    >
      {lines.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {strings.admin.noCompleted}
        </Typography>
      ) : (
        <Stack spacing={0}>
          {lines.map((entry) => {
            const reciter =
              roster.find((person) => person.id === entry.duaReciterId)?.name ??
              strings.admin.none;
            const date = entry.completedAt
              ? new Date(entry.completedAt).toISOString().slice(0, 10)
              : '—';
            return (
              <Typography
                key={entry.id}
                variant="body2"
                sx={{ borderTop: 1, borderColor: 'divider', py: 2 }}
              >
                {`${seriesTitle(entry, toWesternDigits)} · ${strings.admin.completedOn} ${date} · ${strings.admin.reciterIs}: ${reciter}`}
              </Typography>
            );
          })}
        </Stack>
      )}
    </CollapsibleCard>
  );
}
