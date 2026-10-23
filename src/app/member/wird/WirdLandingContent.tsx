import { useState } from 'react';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import { Box, Stack, Typography } from '@mui/material';
import { memberHash } from '@/app/routing/routes';
import { HeroHeader } from '@/components/navigation';
import {
  AppButton,
  CollapsibleCard,
  KhatmaSeriesArtwork,
  NoticeBanner,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { formatPageRanges, toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { seriesTitle } from '@/domain/series';
import type { Khatma, WirdCompletion } from '@/domain/types';
import { wirdCompletedOn } from '@/domain/wird';
import { useMemberIdentity } from '../memberIdentityContext';
import { AssignedPageTiles } from '../khatma/AssignedPageTiles';
import { WirdFinishAction } from './WirdFinishAction';
import { useLocalDate } from '../useLocalDate';

export function WirdLandingContent({
  wird,
  completions,
  memberId,
  paused,
}: {
  wird: Khatma;
  completions: readonly WirdCompletion[];
  memberId: string;
  paused: boolean;
}) {
  const { member } = useMemberIdentity();
  const date = useLocalDate();
  const contentKind = wird.scope.kind === 'dua' ? 'dua' : 'quran';
  const pages = contentKind === 'quran' ? wird.remainingPages : [];
  const done = wirdCompletedOn(completions, memberId, date);
  const title = seriesTitle(wird, toWesternDigits);
  return (
    <Stack component="section" spacing={4} data-react-surface="member" data-route="wird">
      <HeroHeader
        eyebrow={member?.name ? `${strings.member.greeting}، ${member.name}` : undefined}
        title={title}
        titleComponent="h1"
        avatar={
          <KhatmaSeriesArtwork
            variant="avatar"
            imageName={wird.imageName}
            alt={strings.admin.seriesImageAlt}
            size={62}
          />
        }
        avatarVariant="plain"
        tone="wird"
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
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <StatusChip tone="wird" label={strings.member.wirdBadge} />
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {strings.member.wirdDaysCompleted}:{' '}
            {toWesternDigits(wird.completionCount ?? 0)}
          </Typography>
        </Stack>
      </HeroHeader>

      <Stack spacing={4} sx={{ mt: -10, position: 'relative', zIndex: 1 }}>
        {wird.status !== 'active' ? (
          <NoticeBanner tone="primary">{strings.member.wirdArchived}</NoticeBanner>
        ) : paused ? (
          <NoticeBanner tone="primary" sx={{ textAlign: 'center' }}>
            {strings.member.pausedNote}
          </NoticeBanner>
        ) : (
          <SurfaceCard title={<WirdTitle />} appear={0}>
            <Stack spacing={3}>
              {contentKind === 'dua' ? (
                <Typography className="quran-text" sx={{ whiteSpace: 'pre-wrap' }}>
                  {wird.wirdDuaText}
                </Typography>
              ) : (
                <>
                  <Typography sx={{ fontWeight: 600 }}>
                    {toWesternDigits(pages.length)} {strings.member.pagesWord} ·{' '}
                    {formatPageRanges(pages)}
                  </Typography>
                  <AssignedPageTiles khatmaId={wird.id} pages={pages} tone="wird" />
                </>
              )}
              <WirdFinishAction
                wirdId={wird.id}
                memberId={memberId}
                date={date}
                contentKind={contentKind}
                pages={pages}
                storedDone={done}
              />
            </Stack>
          </SurfaceCard>
        )}
        <WirdHistoryCard
          completions={completions.filter((entry) => entry.memberId === memberId)}
        />
      </Stack>
    </Stack>
  );
}

function WirdTitle() {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}>
      <SpaRoundedIcon sx={(theme) => ({ color: theme.custom.wird })} fontSize="small" />
      <Box component="span">{strings.member.wirdTodayHeading}</Box>
    </Box>
  );
}

function WirdHistoryCard({ completions }: { completions: readonly WirdCompletion[] }) {
  const [open, setOpen] = useState(false);
  const entries = [...completions].sort(
    (left, right) => right.completedAt - left.completedAt,
  );
  return (
    <CollapsibleCard
      title={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}
        >
          <HistoryRoundedIcon
            sx={(theme) => ({ color: theme.custom.wird })}
            fontSize="small"
          />
          <Box component="span">{strings.admin.wirdCompletionLogHeading}</Box>
        </Box>
      }
      open={open}
      onOpenChange={setOpen}
      summaryEnd={<StatusChip tone="wird" label={toWesternDigits(entries.length)} />}
    >
      {entries.length === 0 ? (
        <Typography color="text.secondary">
          {strings.admin.wirdCompletionLogEmpty}
        </Typography>
      ) : (
        <Stack component="ul" spacing={0} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {entries.map((entry) => (
            <Box
              component="li"
              key={entry.id}
              sx={{ py: 2, borderTop: 1, borderColor: 'divider' }}
            >
              <Typography variant="body2">
                {entry.contentKind === 'dua'
                  ? strings.admin.wirdCustomDua
                  : formatPageRanges(entry.pages)}
              </Typography>
              <Typography
                component="bdi"
                dir="ltr"
                variant="caption"
                color="text.secondary"
              >
                {formatCompletionTimestamp(entry.completedAt)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </CollapsibleCard>
  );
}

function formatCompletionTimestamp(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
