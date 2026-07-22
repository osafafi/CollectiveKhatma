import { Stack, Typography } from '@mui/material';
import { memberHash } from '@/app/routing/routes';
import { HeroHeader } from '@/components/navigation';
import { AppButton, KhatmaSeriesArtwork, NoticeBanner } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { warningLevel } from '@/domain/distribution';
import { completedInSeries, seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person } from '@/domain/types';
import { useMemberIdentity } from '../memberIdentityContext';
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
  const { member } = useMemberIdentity();
  const mine = assignments.find((assignment) => assignment.memberId === memberId);
  const warning = mine ? warningLevel(mine.missedStreak) : 'none';
  const history = completedInSeries(allKhatmas, khatma.seriesId);
  const title = seriesTitle(khatma, toArabicDigits);

  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="member"
      data-route="khatma"
    >
      <HeroHeader
        eyebrow={member?.name ? `${strings.member.greeting}، ${member.name}` : undefined}
        title={title}
        titleComponent="h1"
        avatar={
          <KhatmaSeriesArtwork
            variant="avatar"
            imageName={khatma.imageName}
            alt={strings.admin.seriesImageAlt}
            size={62}
          />
        }
        avatarVariant="plain"
        action={
          <AppButton
            quiet
            variant="text"
            href={memberHash.khatmas()}
            sx={(theme) => ({ color: theme.custom.heroInk })}
          >
            {strings.member.khatmasHeading}
          </AppButton>
        }
        sx={{ pb: 11 }}
      >
        <RoundLine khatma={khatma} />
      </HeroHeader>

      {/* Cards overlap the hero's rounded bottom edge, per mock 2a. */}
      <Stack spacing={4} sx={{ mt: -10, position: 'relative', zIndex: 1 }}>
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
    </Stack>
  );
}

function RoundLine({ khatma }: { khatma: Khatma }) {
  return (
    <Typography variant="body2" sx={{ opacity: 0.85 }}>
      {strings.member.roundWord} {toArabicDigits(Math.max(1, khatma.roundCount))} ·{' '}
      {strings.member.startedWord} {formatIsoDate(khatma.createdAt)}
    </Typography>
  );
}
