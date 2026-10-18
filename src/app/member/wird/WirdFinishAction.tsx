import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Stack, Typography } from '@mui/material';
import { useFinishWirdWithDailyDua } from '../useFinishWithDailyDua';
import { memberHash } from '@/app/routing/routes';
import { AppButton, NoticeBanner } from '@/components/primitives';
import { strings } from '@/content/strings.ar';

interface WirdFinishActionProps {
  wirdId: string;
  memberId: string;
  date: string;
  contentKind: 'quran' | 'dua';
  pages: readonly number[];
  storedDone: boolean;
  showReadButton?: boolean;
}

/**
 * Keyed on the local day: the finish operation's own success state belongs to
 * the day it was tapped, so a tab left open past midnight offers the new day's
 * button instead of carrying yesterday's "done".
 */
export function WirdFinishAction(props: WirdFinishActionProps) {
  return (
    <WirdDayFinishAction
      key={`${props.wirdId}:${props.memberId}:${props.date}`}
      {...props}
    />
  );
}

function WirdDayFinishAction({
  wirdId,
  memberId,
  date,
  contentKind,
  pages,
  storedDone,
  showReadButton = true,
}: WirdFinishActionProps) {
  const finish = useFinishWirdWithDailyDua({
    wirdId,
    memberId,
    date,
    contentKind,
    pages,
  });
  if (storedDone || finish.isDone) {
    return (
      <NoticeBanner tone="success" sx={{ textAlign: 'center', fontWeight: 600 }}>
        ✓ {strings.member.wirdDoneToday}
      </NoticeBanner>
    );
  }
  if (finish.isQueued) {
    return (
      <NoticeBanner tone="warning" role="status" sx={{ textAlign: 'center' }}>
        {strings.member.queuedFinish}
      </NoticeBanner>
    );
  }
  return (
    <Stack spacing={2}>
      {showReadButton ? (
        <AppButton href={memberHash.khatmaRead(wirdId)}>
          {contentKind === 'dua'
            ? strings.member.wirdDuaRead
            : strings.reader.readMyPages}
        </AppButton>
      ) : null}
      <AppButton
        hero
        startIcon={<CheckRoundedIcon />}
        disabled={finish.isPending}
        onClick={finish.run}
      >
        {strings.member.wirdFinishedToday}
      </AppButton>
      {finish.error ? (
        <Typography role="alert" color="error.main" sx={{ textAlign: 'center' }}>
          {strings.member.saveError}
        </Typography>
      ) : null}
    </Stack>
  );
}
