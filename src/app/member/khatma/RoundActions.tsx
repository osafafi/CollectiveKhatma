import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Stack, Typography } from '@mui/material';
import { ReleasedChunkError, useWriteOperation } from '@/app/operations';
import { memberHash } from '@/app/routing/routes';
import { AppButton, NoticeBanner } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { RoundChunk } from '@/domain/types';

interface RoundActionsProps {
  khatmaId: string;
  memberId: string;
  chunk: RoundChunk;
  storedDone: boolean;
}

export function RoundActions({
  khatmaId,
  memberId,
  chunk,
  storedDone,
}: RoundActionsProps) {
  const markDone = useWriteOperation('markRoundDone');
  const done = storedDone || markDone.state.status === 'success';

  if (done) {
    return (
      <NoticeBanner tone="success" sx={{ textAlign: 'center', fontWeight: 600 }}>
        ✓ {strings.member.doneToday}
      </NoticeBanner>
    );
  }

  const error =
    markDone.state.status === 'failure'
      ? markDone.state.error instanceof ReleasedChunkError
        ? strings.member.releasedNote
        : strings.member.saveError
      : null;

  return (
    <Stack spacing={2}>
      <AppButton href={memberHash.khatmaRead(khatmaId)}>
        {strings.reader.readMyPages}
      </AppButton>
      <AppButton
        hero
        startIcon={<CheckRoundedIcon />}
        disabled={markDone.isPending}
        onClick={() => {
          void markDone.execute(khatmaId, memberId, chunk.round);
        }}
      >
        {strings.member.finishedToday}
      </AppButton>
      {error ? (
        <Typography role="alert" color="error.main" sx={{ textAlign: 'center' }}>
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
}
