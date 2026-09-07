import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Stack, Typography } from '@mui/material';
import { ReleasedChunkError } from '@/app/operations';
import { useFinishWithDailyDua } from '../useFinishWithDailyDua';
import { memberHash } from '@/app/routing/routes';
import { AppButton, NoticeBanner } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { RoundChunk } from '@/domain/types';

interface RoundActionsProps {
  khatmaId: string;
  memberId: string;
  chunk: RoundChunk;
  storedDone: boolean;
  activeSeriesKhatmaIds: readonly string[];
}

export function RoundActions({
  khatmaId,
  memberId,
  chunk,
  storedDone,
  activeSeriesKhatmaIds,
}: RoundActionsProps) {
  const finish = useFinishWithDailyDua({
    khatmaId,
    memberId,
    round: chunk.round,
    activeSeriesKhatmaIds,
  });
  const done = storedDone || finish.isDone;

  if (done) {
    return (
      <NoticeBanner tone="success" sx={{ textAlign: 'center', fontWeight: 600 }}>
        ✓ {strings.member.doneToday}
      </NoticeBanner>
    );
  }

  // Held on this device, not saved to the group — so not the success banner.
  if (finish.isQueued) {
    return (
      <NoticeBanner tone="warning" role="status" sx={{ textAlign: 'center' }}>
        {strings.member.queuedFinish}
      </NoticeBanner>
    );
  }

  const error =
    finish.error instanceof ReleasedChunkError
      ? strings.member.releasedNote
      : finish.error
        ? strings.member.saveError
        : null;

  return (
    <Stack spacing={2}>
      <AppButton href={memberHash.khatmaRead(khatmaId)}>
        {strings.reader.readMyPages}
      </AppButton>
      <AppButton
        hero
        startIcon={<CheckRoundedIcon />}
        disabled={finish.isPending}
        onClick={finish.run}
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
