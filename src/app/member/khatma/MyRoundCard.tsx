import { Chip, Stack, Typography } from '@mui/material';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { isRoundDone, latestReadableChunk } from '@/domain/progress';
import type { Assignment, Khatma } from '@/domain/types';
import { pagesCount } from './formatting';
import { RoundActions } from './RoundActions';

interface MyRoundCardProps {
  khatma: Khatma;
  assignment: Assignment;
  memberId: string;
}

export function MyRoundCard({ khatma, assignment, memberId }: MyRoundCardProps) {
  const chunk = latestReadableChunk(assignment);
  if (!chunk) {
    return (
      <SurfaceCard title={strings.member.todayHeading}>
        <Typography color="text.secondary">
          {strings.member.awaitingDistribution}
        </Typography>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard title={strings.member.todayHeading}>
      <PagesRow pages={chunk.pages} />
      <RoundActions
        key={`${khatma.id}:${chunk.round}`}
        khatmaId={khatma.id}
        memberId={memberId}
        chunk={chunk}
        storedDone={isRoundDone(assignment, chunk.round)}
      />
    </SurfaceCard>
  );
}

function PagesRow({ pages }: { pages: readonly number[] }) {
  return (
    <Stack spacing={2}>
      <Typography sx={{ fontWeight: 600 }}>{pagesCount(pages.length)}</Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {pages.map((page) => (
          <Chip
            key={page}
            label={toArabicDigits(page)}
            sx={{ bgcolor: 'background.default', fontSize: '1.125rem' }}
          />
        ))}
      </Stack>
    </Stack>
  );
}
