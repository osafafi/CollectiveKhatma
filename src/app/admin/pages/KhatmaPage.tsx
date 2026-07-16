import { useState } from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectKhatmaById,
  selectKhatmas,
  selectRoster,
  useAppSelector,
} from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import { useConfirmation } from '@/app/providers';
import { adminHash } from '@/app/routing/routes';
import { useAdminNavigate } from '@/app/routing/hooks';
import { useSurahs } from '@/app/admin/useSurahs';
import { useCreateKhatmaPrefill } from '@/app/admin/createKhatmaPrefillContext';
import { SurahCapacitySelect } from '@/app/admin/SurahCapacitySelect';
import { DonutChart, QuranPageGrid } from '@/components/charts';
import {
  AppButton,
  AppSelectField,
  AppTextField,
  ProgressBar,
  StatusChip,
  SurfaceCard,
  type SelectOption,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import type { Surah } from '@/content/quran/types';
import { requiredCapacity } from '@/domain/assignment';
import { warningLevel } from '@/domain/distribution';
import { isRoundDone, khatmaProgress, latestReadableChunk } from '@/domain/progress';
import { completedInSeries, seriesTitle } from '@/domain/series';
import type {
  Assignment,
  Khatma,
  MemberCapacity,
  Person,
  RoundChunk,
} from '@/domain/types';

/**
 * Admin Khatma detail `#/khatmas/{id}` (inventory §3.4). Header + editable series
 * metadata, then (for an active khatma) the per-member management table
 * and controls, or (for a completed one) just start-next; the series history
 * closes the page.
 *
 * Detail-page selects apply only on their action button (inventory §5 quirk 6):
 * the capacity editor and add-member fields are controlled local state written
 * on `saveCapacity`/`addMember`, while the reciter select writes on change
 * (fire-and-forget, §5 quirk 5) — matching the legacy `controlsCard`. Most member
 * mutations are fire-and-forget with no status surface, also per §5 quirk 5.
 */
export function AdminKhatmaPage({ id }: { id: string }) {
  const khatmas = useAppSelector(selectKhatmas);
  const khatma = useAppSelector((state) => selectKhatmaById(state, id));
  const assignments = useAppSelector((state) => selectAssignmentsForKhatma(state, id));
  const roster = useAppSelector(selectRoster);
  const surahs = useSurahs();

  if (!khatma) {
    return (
      <Stack
        component="section"
        spacing={4}
        data-react-surface="admin"
        data-route="khatma"
      >
        <BackLink />
        <SurfaceCard>
          <Typography color="text.secondary">
            {khatmas.length === 0 ? strings.common.loading : strings.admin.noActive}
          </Typography>
        </SurfaceCard>
      </Stack>
    );
  }

  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="khatma">
      <BackLink />
      <HeaderCard khatma={khatma} assignments={assignments} roster={roster} />
      <EditCard khatma={khatma} />
      {khatma.status === 'active' ? (
        <>
          <MembersCard
            khatma={khatma}
            khatmas={khatmas}
            assignments={assignments}
            roster={roster}
            surahs={surahs}
          />
          <ControlsCard khatma={khatma} roster={roster} />
        </>
      ) : (
        <CompletedControls khatma={khatma} />
      )}
      <HistoryCard khatma={khatma} khatmas={khatmas} roster={roster} />
    </Stack>
  );
}

function BackLink() {
  return (
    <Link
      href={adminHash.khatmas()}
      underline="always"
      variant="body2"
      color="text.secondary"
      sx={{ alignSelf: 'start' }}
    >
      {`‹ ${strings.admin.navKhatmas}`}
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Header: donut, title, status, remaining/round facts, progress bar.
// -----------------------------------------------------------------------------

function HeaderCard({
  khatma,
  assignments,
  roster,
}: {
  khatma: Khatma;
  assignments: readonly Assignment[];
  roster: readonly Person[];
}) {
  const percent =
    khatma.status === 'completed' ? 100 : khatmaProgress(khatma, assignments).percent;
  const title = seriesTitle(khatma, toArabicDigits);
  const facts =
    `${toArabicDigits(khatma.remainingPages.length)} ${strings.admin.pagesRemaining}` +
    ` · ${strings.admin.roundWord} ${toArabicDigits(khatma.roundCount)}` +
    (khatma.lastDistributionDate
      ? ` · ${strings.admin.lastDistribution}: ${khatma.lastDistributionDate}`
      : '');

  return (
    <SurfaceCard>
      <Stack spacing={3}>
        <Stack direction="row" spacing={4} sx={{ alignItems: 'center' }}>
          <DonutChart percent={percent} size={88} />
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" variant="h2" color="primary.main">
              {title}
            </Typography>
            <Box>
              <StatusChip
                size="small"
                tone={khatma.status === 'active' ? 'primary' : 'neutral'}
                label={
                  khatma.status === 'active'
                    ? strings.admin.statusActive
                    : strings.admin.statusCompleted
                }
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {facts}
            </Typography>
          </Stack>
        </Stack>
        <ProgressBar value={percent} label={title} />
        <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />
      </Stack>
    </SurfaceCard>
  );
}

// -----------------------------------------------------------------------------
// Edit card: series name (whole series), number, creation date.
// -----------------------------------------------------------------------------

function EditCard({ khatma }: { khatma: Khatma }) {
  // Seeded once from the khatma; a snapshot that updates the khatma never clobbers
  // an in-progress edit (P2), because these initializers run only on mount.
  const [name, setName] = useState(khatma.seriesName);
  const [number, setNumber] = useState(String(khatma.seriesNumber));
  const [date, setDate] = useState(dateToInput(khatma.createdAt));
  const [status, setStatus] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const renameSeries = useWriteOperation('renameSeries');
  const updateKhatma = useWriteOperation('updateKhatma');

  const onSave = async () => {
    setStatus(null);
    const trimmed = name.trim();
    if (trimmed && trimmed !== khatma.seriesName) {
      const result = await renameSeries.execute(khatma.seriesId, trimmed);
      if (result.status === 'failure') {
        setStatus({ tone: 'error', text: strings.admin.saveError });
        return;
      }
    }
    const changes: Partial<Pick<Khatma, 'seriesNumber' | 'createdAt'>> = {};
    const parsedNumber = parseInt(number, 10);
    if (
      Number.isInteger(parsedNumber) &&
      parsedNumber > 0 &&
      parsedNumber !== khatma.seriesNumber
    ) {
      changes.seriesNumber = parsedNumber;
    }
    const ms = dateToEpoch(date);
    if (ms !== undefined && ms !== khatma.createdAt) changes.createdAt = ms;
    if (Object.keys(changes).length > 0) {
      const result = await updateKhatma.execute(khatma.id, changes);
      if (result.status === 'failure') {
        setStatus({ tone: 'error', text: strings.admin.saveError });
        return;
      }
    }
    setStatus({ tone: 'success', text: strings.admin.saved });
  };

  return (
    <SurfaceCard title={strings.admin.editKhatmaHeading}>
      <Stack spacing={3}>
        <AppTextField
          label={strings.admin.seriesNamePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <AppTextField
            type="number"
            label={strings.admin.khatmaNumberLabel}
            value={number}
            fieldWidth={120}
            onChange={(event) => setNumber(event.target.value)}
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
          <AppTextField
            type="date"
            label={strings.admin.createdDateLabel}
            value={date}
            fieldWidth={200}
            onChange={(event) => setDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <AppButton onClick={() => void onSave()}>{strings.admin.saveKhatma}</AppButton>
          {status ? (
            <Typography
              role={status.tone === 'error' ? 'alert' : 'status'}
              color={status.tone === 'error' ? 'error.main' : 'success.main'}
            >
              {status.text}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

// -----------------------------------------------------------------------------
// Members card (active khatmas only).
// -----------------------------------------------------------------------------

function MembersCard({
  khatma,
  khatmas,
  assignments,
  roster,
  surahs,
}: {
  khatma: Khatma;
  khatmas: readonly Khatma[];
  assignments: readonly Assignment[];
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
}) {
  const rows = khatma.memberIds
    .map((memberId) => assignments.find((assignment) => assignment.memberId === memberId))
    .filter((assignment): assignment is Assignment => assignment !== undefined);

  return (
    <SurfaceCard title={strings.admin.membersProgress}>
      <Stack spacing={0}>
        {rows.length > 0 ? (
          rows.map((assignment) => (
            <MemberRow
              key={assignment.memberId}
              khatma={khatma}
              khatmas={khatmas}
              assignment={assignment}
              roster={roster}
              surahs={surahs}
            />
          ))
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            {strings.common.loading}
          </Typography>
        )}
        <AddMemberRow khatma={khatma} roster={roster} surahs={surahs} />
      </Stack>
    </SurfaceCard>
  );
}

function MemberRow({
  khatma,
  khatmas,
  assignment,
  roster,
  surahs,
}: {
  khatma: Khatma;
  khatmas: readonly Khatma[];
  assignment: Assignment;
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
}) {
  const person = roster.find((candidate) => candidate.id === assignment.memberId);
  const name = person ? `${person.emoji || ''} ${person.name}` : assignment.memberId;
  const level = warningLevel(assignment.missedStreak);
  const chunk = latestReadableChunk(assignment);
  const done = chunk ? isRoundDone(assignment, chunk.round) : false;
  const pending = chunk !== undefined && !done;

  const clearWarning = useWriteOperation('clearWarning');
  const markRoundDone = useWriteOperation('markRoundDone');
  const clearRoundDone = useWriteOperation('clearRoundDone');
  const releaseMemberChunk = useWriteOperation('releaseMemberChunk');
  const removeMemberFromKhatma = useWriteOperation('removeMemberFromKhatma');
  const { confirm } = useConfirmation();

  const onClearWarning = () => {
    const activeIds = khatmas
      .filter((other) => other.seriesId === khatma.seriesId && other.status === 'active')
      .map((other) => other.id);
    void clearWarning.execute(activeIds, assignment.memberId);
  };

  const onToggleChunk = () => {
    if (!chunk) return;
    if (done) void clearRoundDone.execute(khatma.id, assignment.memberId, chunk.round);
    else void markRoundDone.execute(khatma.id, assignment.memberId, chunk.round);
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          <Typography
            component="span"
            sx={{ width: 112, flexShrink: 0, fontWeight: 600 }}
          >
            {name}
          </Typography>
          {level !== 'none' ? (
            <>
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
            </>
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
          <AppButton variant="text" quiet color="error" onClick={() => void onRemove()}>
            {strings.admin.removeFromKhatma}
          </AppButton>
        </Box>
        {person ? (
          <CapacityEditor khatma={khatma} person={person} surahs={surahs} />
        ) : null}
      </Stack>
    </Box>
  );
}

/** The member's current chunk: state text + page span + a mark-done/undo toggle. */
function ChunkChip({
  assignment,
  chunk,
  done,
  onToggle,
}: {
  assignment: Assignment;
  chunk: RoundChunk | undefined;
  done: boolean;
  onToggle: () => void;
}) {
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

/** Edit a member's per-khatma capacity — values apply only on `saveCapacity` (quirk 6). */
function CapacityEditor({
  khatma,
  person,
  surahs,
}: {
  khatma: Khatma;
  person: Person;
  surahs: readonly Surah[] | null;
}) {
  const start = requiredCapacity(khatma, person.id);
  const [pages, setPages] = useState(String(start.pages));
  const [surah, setSurah] = useState(start.surahs);
  const [juz, setJuz] = useState(String(start.juz));
  const updateKhatma = useWriteOperation('updateKhatma');

  const onSave = () => {
    const capacity: MemberCapacity = {
      pages: toCount(pages),
      surahs: surah,
      juz: toCount(juz),
    };
    void updateKhatma.execute(khatma.id, {
      capacities: { ...khatma.capacities, [person.id]: capacity },
    });
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, ps: 2 }}>
      <AppTextField
        type="number"
        label={strings.admin.capacityPages}
        value={pages}
        fieldWidth={96}
        onChange={(event) => setPages(event.target.value)}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <SurahCapacitySelect surahs={surahs} value={surah} onChange={setSurah} />
      <AppTextField
        type="number"
        label={strings.admin.capacityJuz}
        value={juz}
        fieldWidth={96}
        onChange={(event) => setJuz(event.target.value)}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <AppButton variant="text" quiet color="inherit" onClick={onSave}>
        {strings.admin.saveCapacity}
      </AppButton>
    </Box>
  );
}

/** Add a roster candidate to the khatma — values apply only on `addMember` (quirk 6). */
function AddMemberRow({
  khatma,
  roster,
  surahs,
}: {
  khatma: Khatma;
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
}) {
  const candidates = roster.filter((person) => !khatma.memberIds.includes(person.id));
  const addMemberToKhatma = useWriteOperation('addMemberToKhatma');
  const [selectedId, setSelectedId] = useState('');
  const [pages, setPages] = useState('');
  const [surah, setSurah] = useState(0);
  const [juz, setJuz] = useState('0');

  if (candidates.length === 0) return null;

  const firstCandidate = candidates[0]!;
  // Keep the selection valid as candidates change (a member just added leaves the
  // list); default the pages field to the shown candidate's roster pace.
  const resolvedId = candidates.some((candidate) => candidate.id === selectedId)
    ? selectedId
    : firstCandidate.id;
  const pagesValue = pages === '' ? String(firstCandidate.pagesPerDay) : pages;

  const onAdd = () => {
    const capacity: MemberCapacity = {
      pages: toCount(pagesValue),
      surahs: surah,
      juz: toCount(juz),
    };
    void addMemberToKhatma.execute(khatma.id, resolvedId, capacity);
    setSelectedId('');
    setPages('');
    setSurah(0);
    setJuz('0');
  };

  const memberOptions: SelectOption[] = candidates.map((candidate) => ({
    value: candidate.id,
    label: candidate.name,
  }));

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, pt: 2 }}>
      <AppSelectField
        label={strings.admin.addMember}
        value={resolvedId}
        options={memberOptions}
        fieldWidth={180}
        onChange={setSelectedId}
      />
      <AppTextField
        type="number"
        label={strings.admin.capacityPages}
        value={pagesValue}
        fieldWidth={96}
        onChange={(event) => setPages(event.target.value)}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <SurahCapacitySelect surahs={surahs} value={surah} onChange={setSurah} />
      <AppTextField
        type="number"
        label={strings.admin.capacityJuz}
        value={juz}
        fieldWidth={96}
        onChange={(event) => setJuz(event.target.value)}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <AppButton variant="outlined" onClick={onAdd}>
        {strings.admin.addMember}
      </AppButton>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Controls (active) / completed controls.
// -----------------------------------------------------------------------------

function ControlsCard({ khatma, roster }: { khatma: Khatma; roster: readonly Person[] }) {
  const members = roster.filter((person) => khatma.memberIds.includes(person.id));
  const updateKhatma = useWriteOperation('updateKhatma');
  const completeKhatma = useWriteOperation('completeKhatma');
  const deleteKhatma = useWriteOperation('deleteKhatma');
  const { confirm } = useConfirmation();

  const onComplete = async () => {
    const confirmed = await confirm(strings.admin.confirmComplete);
    if (confirmed) void completeKhatma.execute(khatma.id);
  };
  const onDelete = async () => {
    const confirmed = await confirm({
      message: strings.admin.confirmRemoveKhatma,
      tone: 'danger',
    });
    if (confirmed) void deleteKhatma.execute(khatma.id);
  };

  const reciterOptions: SelectOption[] = members.map((person) => ({
    value: person.id,
    label: person.name,
  }));

  return (
    <SurfaceCard>
      <Stack spacing={3}>
        {members.length > 0 ? (
          <AppSelectField
            label={strings.admin.reciterIs}
            value={khatma.duaReciterId ?? ''}
            options={reciterOptions}
            fieldWidth={240}
            // Fire-and-forget write on change (quirk 5) — matches the legacy controlsCard.
            onChange={(value) =>
              void updateKhatma.execute(khatma.id, { duaReciterId: value })
            }
          />
        ) : null}
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <StartNextButton khatma={khatma} />
          <AppButton onClick={() => void onComplete()}>
            {strings.admin.markComplete}
          </AppButton>
          <AppButton variant="text" quiet color="error" onClick={() => void onDelete()}>
            {strings.admin.remove}
          </AppButton>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

function CompletedControls({ khatma }: { khatma: Khatma }) {
  return (
    <SurfaceCard>
      <StartNextButton khatma={khatma} />
    </SurfaceCard>
  );
}

/**
 * Start khatma N+1 in this series with the same members/scope/capacities by
 * default — no confirmation (inventory §5 quirk 3). Hands the prefill to the
 * Khatmas create form through the shared context and jumps to `#/khatmas`.
 */
function StartNextButton({ khatma }: { khatma: Khatma }) {
  const { requestPrefill } = useCreateKhatmaPrefill();
  const navigate = useAdminNavigate();

  const onStartNext = () => {
    requestPrefill({
      seriesName: khatma.seriesName,
      scope: khatma.scope,
      memberIds: [...khatma.memberIds],
      memberCaps: Object.fromEntries(
        Object.entries(khatma.capacities).map(([memberId, capacity]) => [
          memberId,
          { ...capacity },
        ]),
      ),
      reciterId: khatma.duaReciterId,
    });
    navigate({ name: 'khatmas' });
  };

  return (
    <AppButton variant="outlined" onClick={onStartNext}>
      {strings.admin.startNext}
    </AppButton>
  );
}

// -----------------------------------------------------------------------------
// Series history.
// -----------------------------------------------------------------------------

function HistoryCard({
  khatma,
  khatmas,
  roster,
}: {
  khatma: Khatma;
  khatmas: readonly Khatma[];
  roster: readonly Person[];
}) {
  const history = completedInSeries(khatmas, khatma.seriesId).filter(
    (other) => other.id !== khatma.id,
  );
  if (history.length === 0 && khatma.status === 'active') {
    return (
      <SurfaceCard title={strings.admin.historyHeading}>
        <Typography color="text.secondary">{strings.admin.noCompleted}</Typography>
      </SurfaceCard>
    );
  }
  const lines = khatma.status === 'completed' ? [khatma, ...history] : history;

  return (
    <SurfaceCard title={strings.admin.historyHeading}>
      <Stack spacing={0}>
        {lines.map((entry) => {
          const reciter =
            roster.find((person) => person.id === entry.duaReciterId)?.name ??
            strings.admin.none;
          const date = entry.completedAt
            ? new Date(entry.completedAt).toISOString().slice(0, 10)
            : '—';
          return (
            <Typography
              key={entry.id}
              variant="body2"
              sx={{ borderBottom: 1, borderColor: 'divider', py: 2 }}
            >
              {`${seriesTitle(entry, toArabicDigits)} · ${strings.admin.completedOn} ${date} · ${strings.admin.reciterIs}: ${reciter}`}
            </Typography>
          );
        })}
      </Stack>
    </SurfaceCard>
  );
}

// -----------------------------------------------------------------------------
// Small helpers (pure).
// -----------------------------------------------------------------------------

/** "٣ صفحات (١٥–١٧)" — count plus first–last page numbers. */
function chunkSpan(chunk: RoundChunk): string {
  const count = chunk.pages.length;
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  const first = chunk.pages[0];
  const last = chunk.pages[count - 1];
  const span =
    first === undefined || last === undefined || first === last
      ? toArabicDigits(first ?? 0)
      : `${toArabicDigits(first)}–${toArabicDigits(last)}`;
  return `${toArabicDigits(count)} ${word} (${span})`;
}

/** Clamp a text numeric field to a non-negative integer, like the legacy fields. */
function toCount(value: string): number {
  return Math.max(0, parseInt(value, 10) || 0);
}

/** Local midnight of a YYYY-MM-DD string as epoch ms, or undefined if unset/invalid. */
function dateToEpoch(date: string): number | undefined {
  if (!date) return undefined;
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Epoch ms → local YYYY-MM-DD for a date input. */
function dateToInput(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
