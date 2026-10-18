import { useState } from 'react';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { Box, Stack, Typography } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import { useConfirmation } from '@/app/providers';
import type { ListenerStatus } from '@/app/store';
import {
  AppButton,
  AppSelectField,
  CollapsibleCard,
  KhatmaSeriesArtwork,
  StatusChip,
  SurfaceCard,
  type SelectOption,
} from '@/components/primitives';
import type { Surah } from '@/content/quran/types';
import { formatPageRanges, toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { seriesTitle } from '@/domain/series';
import type { Khatma, Person, WirdCompletion } from '@/domain/types';
import type { QuranScopeMaps } from '../useQuranScopeMaps';
import { formatReadingTimestamp } from '../khatma/formatting';
import { KhatmaMetadataEditor } from '../khatma/KhatmaMetadataEditor';
import { WirdContentFields } from './WirdContentFields';
import { resolveWirdContent, wirdContentDraft } from './wirdContentDraft';

export function WirdAdminDetail({
  wird,
  roster,
  surahs,
  scopeMaps,
  completions,
  completionStatus,
}: {
  wird: Khatma;
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
  scopeMaps: QuranScopeMaps | null;
  completions: readonly WirdCompletion[];
  completionStatus: ListenerStatus | undefined;
}) {
  return (
    <>
      <WirdHeaderCard wird={wird} roster={roster} />
      <KhatmaMetadataEditor khatma={wird} />
      <WirdEditorCard wird={wird} roster={roster} surahs={surahs} scopeMaps={scopeMaps} />
      <WirdControls wird={wird} />
      <WirdCompletionLogCard
        completions={completions}
        roster={roster}
        status={completionStatus}
      />
    </>
  );
}

export function WirdHeaderCard({
  wird,
  roster,
}: {
  wird: Khatma;
  roster: readonly Person[];
}) {
  const title = seriesTitle(wird, toWesternDigits);
  const member = roster.find((person) => person.id === wird.memberIds[0]);
  const content =
    wird.scope.kind === 'dua'
      ? strings.admin.wirdCustomDua
      : `${toWesternDigits(wird.totalPages)} ${strings.member.pagesWord}`;
  return (
    <SurfaceCard tone="gold">
      <Stack direction="row" spacing={3} useFlexGap sx={{ alignItems: 'center' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={wird.imageName}
          alt={strings.admin.seriesImageAlt}
          size={88}
        />
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Typography component="h1" variant="h2">
              {title}
            </Typography>
            <StatusChip tone="accent" label={strings.member.wirdBadge} />
            <StatusChip
              tone={wird.status === 'active' ? 'primary' : 'neutral'}
              label={
                wird.status === 'active'
                  ? strings.admin.statusActive
                  : strings.admin.statusArchived
              }
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {member?.name ?? strings.admin.none} · {content}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {strings.member.wirdDaysCompleted}:{' '}
            {toWesternDigits(wird.completionCount ?? 0)}
          </Typography>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

export function WirdEditorCard({
  wird,
  roster,
  surahs,
  scopeMaps,
}: {
  wird: Khatma;
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
  scopeMaps: QuranScopeMaps | null;
}) {
  // Seeded once, like the metadata editor, so live snapshots never overwrite
  // an edit in progress.
  const [memberId, setMemberId] = useState(wird.memberIds[0] ?? '');
  const [content, setContent] = useState(() =>
    wirdContentDraft(wird.scope, wird.wirdDuaText),
  );
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const updateWird = useWriteOperation('updateWird');
  const memberOptions: SelectOption[] = roster.map((person) => ({
    value: person.id,
    label: person.name,
  }));

  const save = async () => {
    setMessage(null);
    if (!memberId) {
      setMessage({ error: true, text: strings.admin.selectOneWirdMember });
      return;
    }
    const resolved = resolveWirdContent(content, scopeMaps);
    if ('error' in resolved) {
      setMessage({ error: true, text: resolved.error });
      return;
    }
    const result = await updateWird.execute(wird.id, { memberId, ...resolved.content });
    setMessage({
      error: result.status === 'failure',
      text: result.status === 'failure' ? strings.admin.saveError : strings.admin.saved,
    });
  };

  return (
    <SurfaceCard title={strings.admin.editWirdContentHeading}>
      <Stack spacing={3}>
        <AppSelectField
          label={strings.admin.wirdMemberLabel}
          value={memberId}
          options={memberOptions}
          onChange={setMemberId}
        />
        <WirdContentFields draft={content} surahs={surahs} onChange={setContent} />
        <Box>
          <AppButton disabled={updateWird.isPending} onClick={() => void save()}>
            {strings.admin.saveWird}
          </AppButton>
        </Box>
        {message ? (
          <Typography
            role={message.error ? 'alert' : 'status'}
            color={message.error ? 'error' : 'success.main'}
          >
            {message.text}
          </Typography>
        ) : null}
      </Stack>
    </SurfaceCard>
  );
}

export function WirdControls({ wird }: { wird: Khatma }) {
  const setStatus = useWriteOperation('setWirdStatus');
  const deleteSeries = useWriteOperation('deleteKhatma');
  const { confirm } = useConfirmation();
  const archive = async () => {
    if (wird.status === 'active') {
      if (!(await confirm(strings.admin.confirmArchiveWird))) return;
      void setStatus.execute(wird.id, 'archived');
    } else void setStatus.execute(wird.id, 'active');
  };
  const remove = async () => {
    if (await confirm({ message: strings.admin.confirmRemoveWird, tone: 'danger' })) {
      void deleteSeries.execute(wird.id);
    }
  };
  return (
    <SurfaceCard>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <AppButton onClick={() => void archive()}>
          {wird.status === 'active'
            ? strings.admin.archiveWird
            : strings.admin.reactivateWird}
        </AppButton>
        <AppButton variant="text" quiet color="error" onClick={() => void remove()}>
          {strings.admin.remove}
        </AppButton>
      </Stack>
    </SurfaceCard>
  );
}

export function WirdCompletionLogCard({
  completions,
  roster,
  status,
}: {
  completions: readonly WirdCompletion[];
  roster: readonly Person[];
  status: ListenerStatus | undefined;
}) {
  const [open, setOpen] = useState(false);
  const entries = [...completions].sort((a, b) => b.completedAt - a.completedAt);
  return (
    <CollapsibleCard
      title={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}
        >
          <HistoryRoundedIcon color="secondary" fontSize="small" />
          <Box component="span">{strings.admin.wirdCompletionLogHeading}</Box>
        </Box>
      }
      open={open}
      onOpenChange={setOpen}
      summaryEnd={
        status === 'ready' ? (
          <StatusChip tone="accent" label={toWesternDigits(entries.length)} />
        ) : undefined
      }
    >
      {status !== 'ready' ? (
        <Typography color="text.secondary">{strings.common.loading}</Typography>
      ) : entries.length === 0 ? (
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
              <Typography sx={{ fontWeight: 600 }}>
                {roster.find((person) => person.id === entry.memberId)?.name ??
                  entry.memberId}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  {entry.contentKind === 'dua'
                    ? strings.admin.wirdCustomDua
                    : formatPageRanges(entry.pages)}
                </Typography>
                <Typography
                  component="bdi"
                  dir="ltr"
                  variant="body2"
                  color="text.secondary"
                >
                  {formatReadingTimestamp(entry.completedAt)}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </CollapsibleCard>
  );
}
