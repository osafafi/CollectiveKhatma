import { Stack, Typography } from '@mui/material';
import { memberHash } from '@/app/routing/routes';
import { AppButton, KhatmaSeriesArtwork, NoticeBanner } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { warningLevel } from '@/domain/distribution';
import { completedInSeries, seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person } from '@/domain/types';
import { formatIsoDate } from './formatting';
import { GroupProgressCard } from './GroupProgressCard';
import { HistoryCard } from './HistoryCard';
import { MyRoundCard } from './MyRoundCard';

interface KhatmaLandingContentProps {
  khatma: Khatma;
  allKhatmas: readonly Khatma[];
  assignments: readonly Assignment[];
  roster: readonly Person[];
  memberId: string;
  paused: boolean;
}

export function KhatmaLandingContent({
  khatma,
  allKhatmas,
  assignments,
  roster,
  memberId,
  paused,
}: KhatmaLandingContentProps) {
  const mine = assignments.find((assignment) => assignment.memberId === memberId);
  const warning = mine ? warningLevel(mine.missedStreak) : 'none';
  const history = completedInSeries(allKhatmas, khatma.seriesId);

  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="member"
      data-route="khatma"
    >
      <AppButton
        quiet
        variant="text"
        href={memberHash.khatmas()}
        sx={{ alignSelf: 'start' }}
      >
        {strings.member.khatmasHeading}
      </AppButton>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={khatma.imageName}
          alt={strings.admin.seriesImageAlt}
          size={72}
        />
        <Typography component="h1" variant="h2" color="primary.main">
          {seriesTitle(khatma, toArabicDigits)}
        </Typography>
      </Stack>
      <RoundLine khatma={khatma} />

      {warning !== 'none' ? (
        <NoticeBanner tone={warning === 'red' ? 'danger' : 'warning'}>
          ⚠ {strings.member.warningNote}
        </NoticeBanner>
      ) : null}

      {paused ? (
        <NoticeBanner tone="primary" sx={{ textAlign: 'center' }}>
          {strings.member.pausedNote}
        </NoticeBanner>
      ) : mine ? (
        <MyRoundCard khatma={khatma} assignment={mine} memberId={memberId} />
      ) : null}

      <GroupProgressCard khatma={khatma} assignments={assignments} roster={roster} />

      {history.length > 0 ? <HistoryCard khatmas={history} /> : null}
    </Stack>
  );
}

function RoundLine({ khatma }: { khatma: Khatma }) {
  return (
    <Stack
      direction="row"
      spacing={3}
      sx={{ justifyContent: 'space-between', color: 'text.secondary' }}
    >
      <Typography>
        {strings.member.roundWord} {toArabicDigits(Math.max(1, khatma.roundCount))}
      </Typography>
      <Typography>
        {strings.member.startedWord} {formatIsoDate(khatma.createdAt)}
      </Typography>
    </Stack>
  );
}
