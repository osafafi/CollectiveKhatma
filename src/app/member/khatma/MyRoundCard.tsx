import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import { Box, Stack, Typography } from '@mui/material';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { isRoundDone, latestReadableChunk } from '@/domain/progress';
import type { Assignment, Khatma } from '@/domain/types';
import { AssignedPageTiles } from './AssignedPageTiles';
import { pagesCount } from './formatting';
import { RoundActions } from './RoundActions';

interface MyRoundCardProps {
  khatma: Khatma;
  assignment: Assignment;
  memberId: string;
  activeSeriesKhatmaIds: readonly string[];
}

export function MyRoundCard({
  khatma,
  assignment,
  memberId,
  activeSeriesKhatmaIds,
}: MyRoundCardProps) {
  const chunk = latestReadableChunk(assignment);
  if (!chunk) {
    return (
      <SurfaceCard title={<RoundCardTitle />} appear={0}>
        <Typography color="text.secondary">
          {strings.member.awaitingDistribution}
        </Typography>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard title={<RoundCardTitle />} appear={0}>
      <PagesRow khatmaId={khatma.id} pages={chunk.pages} />
      <RoundActions
        key={`${khatma.id}:${chunk.round}:${chunk.pages.join(',')}`}
        khatmaId={khatma.id}
        memberId={memberId}
        chunk={chunk}
        storedDone={isRoundDone(assignment, chunk.round)}
        activeSeriesKhatmaIds={activeSeriesKhatmaIds}
      />
    </SurfaceCard>
  );
}

function RoundCardTitle() {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}>
      <AutoStoriesRoundedIcon color="primary" fontSize="small" />
      <Box component="span">{strings.member.todayHeading}</Box>
    </Box>
  );
}

function PagesRow({ khatmaId, pages }: { khatmaId: string; pages: readonly number[] }) {
  return (
    <Stack spacing={2}>
      <Typography sx={{ fontWeight: 600 }}>{pagesCount(pages.length)}</Typography>
      <AssignedPageTiles khatmaId={khatmaId} pages={pages} />
    </Stack>
  );
}
