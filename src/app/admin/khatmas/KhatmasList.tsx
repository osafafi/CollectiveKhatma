import { Link, Stack, Typography } from '@mui/material';
import { selectAssignmentsForKhatma, useAppSelector } from '@/app/store';
import { AdminRouteLink } from '@/app/routing/RouteLink';
import { KhatmaSeriesArtwork, StatusChip, SurfaceCard } from '@/components/primitives';
import { toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { khatmaProgress } from '@/domain/progress';
import { khatmasListEntries, seriesTitle } from '@/domain/series';
import type { Khatma } from '@/domain/types';

/** Ongoing khatmas plus the terminal entry of any fully ended series. */
export function KhatmasList({ khatmas }: { khatmas: readonly Khatma[] }) {
  const entries = khatmasListEntries(khatmas);
  if (entries.length === 0) {
    return (
      <SurfaceCard>
        <Typography color="text.secondary">{strings.admin.noActive}</Typography>
      </SurfaceCard>
    );
  }
  const ordered = [...entries].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  return (
    <SurfaceCard>
      <Stack spacing={0}>
        {ordered.map((khatma) => (
          <KhatmaListLine key={khatma.id} khatma={khatma} />
        ))}
      </Stack>
    </SurfaceCard>
  );
}

function KhatmaListLine({ khatma }: { khatma: Khatma }) {
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatma.id),
  );
  const percent =
    khatma.status === 'completed' ? 100 : khatmaProgress(khatma, assignments).percent;

  return (
    <Link
      component={AdminRouteLink}
      to={{ name: 'khatma', id: khatma.id }}
      underline="none"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: 1,
        borderColor: 'divider',
        py: 2,
      }}
    >
      <KhatmaSeriesArtwork
        variant="avatar"
        imageName={khatma.imageName}
        alt={strings.admin.seriesImageAlt}
        size={48}
      />
      <Typography component="span" sx={{ flex: 1, fontWeight: 600 }} color="primary.main">
        {seriesTitle(khatma, toArabicDigits)}
      </Typography>
      <StatusChip
        size="small"
        tone={khatma.status === 'active' ? 'primary' : 'neutral'}
        label={
          khatma.status === 'active'
            ? strings.admin.statusActive
            : strings.admin.statusCompleted
        }
      />
      <Typography
        component="span"
        variant="body2"
        color="text.secondary"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {`${toArabicDigits(percent)}٪`}
      </Typography>
    </Link>
  );
}
