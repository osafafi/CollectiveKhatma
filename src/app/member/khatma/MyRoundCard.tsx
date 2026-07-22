import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
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
      <SurfaceCard title={strings.member.todayHeading} appear={0}>
        <Typography color="text.secondary">
          {strings.member.awaitingDistribution}
        </Typography>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard title={strings.member.todayHeading} appear={0}>
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
          // The design's gold page tiles (mock 2a): goldSoft surface, goldInk
          // number, generous touch size.
          <Box
            key={page}
            component="span"
            sx={(theme) => ({
              minWidth: 52,
              textAlign: 'center',
              fontSize: '1.125rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: theme.custom.goldInk,
              bgcolor: theme.custom.goldSoft,
              border: `1px solid ${alpha(theme.custom.gold, 0.35)}`,
              borderRadius: `${theme.custom.radii.button}px`,
              px: 1.5,
              py: 2,
            })}
          >
            {toArabicDigits(page)}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
