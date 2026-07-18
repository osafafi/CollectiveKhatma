import { Stack, Typography } from '@mui/material';
import { SurfaceCard } from '@/components/primitives';
import { toArabicDigits } from '@/content/quran/symbols';
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
  const history = completedInSeries(khatmas, khatma.seriesId).filter(
    (other) => other.id !== khatma.id,
  );
  if (history.length === 0 && khatma.status === 'active') {
    return (
      <SurfaceCard title={strings.admin.historyHeading}>
        <Typography color="text.secondary">{strings.admin.noCompleted}</Typography>
      </SurfaceCard>
    );
  }
  const lines = khatma.status === 'completed' ? [khatma, ...history] : history;

  return (
    <SurfaceCard title={strings.admin.historyHeading}>
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
              sx={{ borderBottom: 1, borderColor: 'divider', py: 2 }}
            >
              {`${seriesTitle(entry, toArabicDigits)} · ${strings.admin.completedOn} ${date} · ${strings.admin.reciterIs}: ${reciter}`}
            </Typography>
          );
        })}
      </Stack>
    </SurfaceCard>
  );
}
