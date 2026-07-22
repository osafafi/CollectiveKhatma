import { Stack, Typography } from '@mui/material';
import { shallowEqual } from 'react-redux';
import { selectAssignmentByMemberId, selectKhatmas, useAppSelector } from '@/app/store';
import { memberHash } from '@/app/routing/routes';
import { KhatmaSeriesArtwork, StatusChip, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { currentChunk } from '@/domain/progress';
import { seriesTitle } from '@/domain/series';
import type { Khatma, RoundChunk } from '@/domain/types';
import { pagesCount } from './khatma/formatting';
import { useMemberIdentity } from './memberIdentityContext';

/** Personal-page shortcut to every unread assignment across the member's khatmas. */
export function PendingAssignmentsCard() {
  const { memberId } = useMemberIdentity();
  const khatmas = useAppSelector(selectKhatmas);
  const activeKhatmas = khatmas.filter(
    (khatma) => khatma.status === 'active' && khatma.memberIds.includes(memberId),
  );
  const assignments = useAppSelector(
    (state) =>
      activeKhatmas.map((khatma) =>
        selectAssignmentByMemberId(state, khatma.id, memberId),
      ),
    shallowEqual,
  );
  const pending = activeKhatmas.flatMap((khatma, index) => {
    const assignment = assignments[index];
    const chunk = assignment ? currentChunk(assignment) : undefined;
    return chunk ? [{ khatma, chunk }] : [];
  });

  return (
    <SurfaceCard title={strings.personal.pendingAssignmentsHeading} appear={0}>
      {pending.length === 0 ? (
        <Typography color="text.secondary">
          {strings.personal.noPendingAssignments}
        </Typography>
      ) : (
        <Stack spacing={3}>
          {pending.map(({ khatma, chunk }) => (
            <PendingAssignmentEntry key={khatma.id} khatma={khatma} chunk={chunk} />
          ))}
        </Stack>
      )}
    </SurfaceCard>
  );
}

function PendingAssignmentEntry({
  khatma,
  chunk,
}: {
  khatma: Khatma;
  chunk: RoundChunk;
}) {
  const title = seriesTitle(khatma, toArabicDigits);
  const pageNumbers = chunk.pages.map(toArabicDigits).join('، ');

  return (
    <SurfaceCard
      href={memberHash.khatmaRead(khatma.id)}
      linkLabel={`${strings.reader.readMyPages}: ${title}`}
      sx={{ height: '100%' }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={khatma.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={62}
        />
        <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            <StatusChip tone="accent" label={pagesCount(chunk.pages.length)} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {strings.personal.assignedPages}: {pageNumbers}
          </Typography>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}
