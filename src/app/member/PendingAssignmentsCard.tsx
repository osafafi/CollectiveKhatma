import { Stack, Typography } from '@mui/material';
import { shallowEqual } from 'react-redux';
import {
  selectAssignmentByMemberId,
  selectKhatmas,
  selectWirdCompletions,
  useAppSelector,
} from '@/app/store';
import { memberHash } from '@/app/routing/routes';
import { KhatmaSeriesArtwork, StatusChip, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import { currentChunk } from '@/domain/progress';
import { seriesTitle } from '@/domain/series';
import type { Khatma, RoundChunk } from '@/domain/types';
import { AssignedPageTiles } from './khatma/AssignedPageTiles';
import { pagesCount } from './khatma/formatting';
import { useMemberIdentity } from './memberIdentityContext';
import { isKhatma, isWird, wirdCompletedOn } from '@/domain/wird';
import { useLocalDate } from './useLocalDate';

/** Personal-page shortcut to every unread assignment across the member's khatmas. */
export function PendingAssignmentsCard() {
  const { memberId, member } = useMemberIdentity();
  const today = useLocalDate();
  // A paused member cannot open or complete a Wird, so it is not pending.
  const paused = member ? !member.enabled : false;
  const khatmas = useAppSelector(selectKhatmas);
  const activeKhatmas = khatmas.filter(
    (khatma) =>
      isKhatma(khatma) &&
      khatma.status === 'active' &&
      khatma.memberIds.includes(memberId),
  );
  const activeWirds = khatmas.filter(
    (series) =>
      isWird(series) && series.status === 'active' && series.memberIds.includes(memberId),
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
  const wirdCompletions = useAppSelector(
    (state) => activeWirds.map((wird) => selectWirdCompletions(state, wird.id)),
    shallowEqual,
  );
  const pendingWirds = paused
    ? []
    : activeWirds.filter(
        (_wird, index) => !wirdCompletedOn(wirdCompletions[index] ?? [], memberId, today),
      );

  return (
    <SurfaceCard title={strings.personal.pendingAssignmentsHeading} appear={0}>
      {pending.length === 0 && pendingWirds.length === 0 ? (
        <Typography color="text.secondary">
          {strings.personal.noPendingAssignments}
        </Typography>
      ) : (
        <Stack spacing={3}>
          {pending.map(({ khatma, chunk }) => (
            <PendingAssignmentEntry key={khatma.id} khatma={khatma} chunk={chunk} />
          ))}
          {pendingWirds.map((wird) => (
            <PendingWirdEntry key={wird.id} wird={wird} />
          ))}
        </Stack>
      )}
    </SurfaceCard>
  );
}

function PendingWirdEntry({ wird }: { wird: Khatma }) {
  const title = seriesTitle(wird, toWesternDigits);
  const pages = wird.scope.kind === 'dua' ? [] : wird.remainingPages;
  return (
    <SurfaceCard
      href={memberHash.khatmaRead(wird.id)}
      linkLabel={`${strings.member.openWird}: ${title}`}
      actions={
        pages.length > 0 ? (
          <AssignedPageTiles khatmaId={wird.id} pages={pages} />
        ) : undefined
      }
      tone="gold"
      sx={{ height: '100%' }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={wird.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={62}
        />
        <Stack
          direction="row"
          spacing={2}
          sx={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          <StatusChip
            tone="accent"
            label={
              wird.scope.kind === 'dua'
                ? strings.admin.wirdCustomDua
                : pagesCount(pages.length)
            }
          />
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

/**
 * The card opens the reader where the member left off; each page tile below it
 * opens the reader on that page instead.
 */
function PendingAssignmentEntry({
  khatma,
  chunk,
}: {
  khatma: Khatma;
  chunk: RoundChunk;
}) {
  const title = seriesTitle(khatma, toWesternDigits);

  return (
    <SurfaceCard
      href={memberHash.khatmaRead(khatma.id)}
      linkLabel={`${strings.reader.readMyPages}: ${title}`}
      actions={<AssignedPageTiles khatmaId={khatma.id} pages={chunk.pages} />}
      sx={{ height: '100%' }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={khatma.imageName}
          alt={`${strings.admin.seriesImageAlt}: ${title}`}
          size={62}
        />
        <Stack
          direction="row"
          spacing={2}
          sx={{
            flex: 1,
            minWidth: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          <StatusChip tone="accent" label={pagesCount(chunk.pages.length)} />
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}
