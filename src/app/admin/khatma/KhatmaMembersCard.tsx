import {
  Box,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import PersonRemoveAlt1Icon from '@mui/icons-material/PersonRemoveAlt1';
import { useWriteOperation } from '@/app/operations';
import { useConfirmation } from '@/app/providers';
import { AppButton, StatusChip, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { Surah } from '@/content/quran/types';
import { warningLevel } from '@/domain/distribution';
import { isRoundDone, latestReadableChunk } from '@/domain/progress';
import { activeKhatmaIdsInSeries } from '@/domain/series';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import { AddKhatmaMemberForm } from './AddKhatmaMemberForm';
import { KhatmaCapacityEditor } from './KhatmaCapacityEditor';
import { chunkSpan } from './formatting';

interface KhatmaMembersCardProps {
  khatma: Khatma;
  khatmas: readonly Khatma[];
  assignments: readonly Assignment[];
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
}

/** Member progress and member-management actions for an active khatma. */
export function KhatmaMembersCard({
  khatma,
  khatmas,
  assignments,
  roster,
  surahs,
}: KhatmaMembersCardProps) {
  const rows = khatma.memberIds
    .flatMap((memberId) => {
      const person = roster.find((candidate) => candidate.id === memberId);
      if (!person) return [];
      return [
        {
          person,
          assignment: assignments.find(
            (assignment) => assignment.memberId === memberId,
          ) ?? {
            memberId,
            rounds: [],
            doneByRound: {},
            missedStreak: 0,
          },
        },
      ];
    })
    .sort(
      (left, right) =>
        Number(left.person.enabled === false) - Number(right.person.enabled === false),
    );
  return (
    <SurfaceCard title={strings.admin.membersProgress}>
      <Stack spacing={0}>
        {rows.length > 0 ? (
          rows.map(({ person, assignment }) => (
            <KhatmaMemberRow
              key={assignment.memberId}
              khatma={khatma}
              khatmas={khatmas}
              assignment={assignment}
              person={person}
              surahs={surahs}
            />
          ))
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            {strings.common.loading}
          </Typography>
        )}
        <AddKhatmaMemberForm khatma={khatma} roster={roster} surahs={surahs} />
      </Stack>
    </SurfaceCard>
  );
}

interface KhatmaMemberRowProps {
  khatma: Khatma;
  khatmas: readonly Khatma[];
  assignment: Assignment;
  person: Person;
  surahs: readonly Surah[] | null;
}

function KhatmaMemberRow({
  khatma,
  khatmas,
  assignment,
  person,
  surahs,
}: KhatmaMemberRowProps) {
  const name = `${person.emoji || ''} ${person.name}`;
  const level = warningLevel(assignment.missedStreak);
  const chunk = latestReadableChunk(assignment);
  const done = chunk ? isRoundDone(assignment, chunk.round) : false;
  const pending = chunk !== undefined && !done;

  const clearWarning = useWriteOperation('clearWarning');
  const markRoundDone = useWriteOperation('markRoundDone');
  const clearRoundDone = useWriteOperation('clearRoundDone');
  const releaseMemberChunk = useWriteOperation('releaseMemberChunk');
  const removeMemberFromKhatma = useWriteOperation('removeMemberFromKhatma');
  const updatePerson = useWriteOperation('updatePerson');
  const { confirm } = useConfirmation();

  const onClearWarning = () => {
    const activeIds = activeKhatmaIdsInSeries(khatmas, khatma.seriesId);
    void clearWarning.execute(activeIds, assignment.memberId);
  };

  const onToggleChunk = () => {
    if (!chunk) return;
    if (done) void clearRoundDone.execute(khatma.id, assignment.memberId, chunk.round);
    else {
      void markRoundDone.execute(
        khatma.id,
        assignment.memberId,
        chunk.round,
        activeKhatmaIdsInSeries(khatmas, khatma.seriesId),
      );
    }
  };

  const onReturnToPool = async () => {
    const confirmed = await confirm(strings.admin.confirmReturnToPool);
    if (confirmed) void releaseMemberChunk.execute(khatma.id, assignment.memberId);
  };

  const onRemove = async () => {
    const confirmed = await confirm({
      message: strings.admin.confirmRemoveFromKhatma,
      tone: 'danger',
    });
    if (confirmed) void removeMemberFromKhatma.execute(khatma.id, assignment.memberId);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', py: 2 }}>
      <Stack spacing={1}>
        {level !== 'none' ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            <StatusChip
              size="small"
              tone={level === 'red' ? 'danger' : 'warning'}
              label={`⚠ ${name} · ${
                level === 'red'
                  ? strings.admin.warningRedWord
                  : strings.admin.warningYellowWord
              }`}
            />
            <AppButton variant="text" quiet color="inherit" onClick={onClearWarning}>
              {strings.admin.clearWarning}
            </AppButton>
          </Box>
        ) : null}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          <IconButton
            size="small"
            color="error"
            title={strings.admin.removeFromKhatma}
            aria-label={`${strings.admin.removeFromKhatma}: ${name}`}
            onClick={() => void onRemove()}
          >
            <PersonRemoveAlt1Icon fontSize="small" />
          </IconButton>
          <Typography
            component="span"
            sx={{
              width: 112,
              flexShrink: 0,
              fontWeight: 600,
              ...(person.enabled === false
                ? { color: 'text.secondary', textDecoration: 'line-through' }
                : {}),
            }}
          >
            {name}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                color="warning"
                checked={person.holdPages === true}
                disabled={updatePerson.isPending}
                onChange={(_, checked) => {
                  void updatePerson.execute(person.id, { holdPages: checked });
                }}
                slotProps={{
                  input: {
                    'aria-label': `${strings.personal.holdPages}: ${person.name}`,
                  },
                }}
              />
            }
            label={strings.personal.holdPages}
            sx={{ m: 0 }}
          />
          {person.enabled === false ? (
            <AppButton
              variant="outlined"
              disabled={updatePerson.isPending}
              onClick={() => void updatePerson.execute(person.id, { enabled: true })}
            >
              {strings.admin.enable}
            </AppButton>
          ) : null}
          <ChunkChip
            assignment={assignment}
            chunk={chunk}
            done={done}
            onToggle={onToggleChunk}
          />
          {pending ? (
            <AppButton
              variant="text"
              quiet
              color="inherit"
              onClick={() => void onReturnToPool()}
            >
              {strings.admin.returnToPool}
            </AppButton>
          ) : null}
        </Box>
        {person.enabled ? (
          <KhatmaCapacityEditor khatma={khatma} person={person} surahs={surahs} />
        ) : null}
      </Stack>
    </Box>
  );
}

interface ChunkChipProps {
  assignment: Assignment;
  chunk: RoundChunk | undefined;
  done: boolean;
  onToggle: () => void;
}

/** Current chunk state and the mark-done/undo action. */
function ChunkChip({ assignment, chunk, done, onToggle }: ChunkChipProps) {
  if (!chunk) {
    const last = assignment.rounds[assignment.rounds.length - 1];
    return (
      <Typography component="span" variant="body2" color="text.secondary">
        {last?.released === true ? strings.admin.chunkReleased : strings.admin.noChunk}
      </Typography>
    );
  }
  const label = `${chunkSpan(chunk)} · ${done ? strings.admin.chunkDone : strings.admin.chunkPending}`;
  return (
    <StatusChip
      size="small"
      clickable
      tone={done ? 'success' : 'neutral'}
      label={label}
      title={done ? strings.admin.undo : strings.admin.markDone}
      onClick={onToggle}
    />
  );
}
