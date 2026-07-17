import { useState } from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectKhatmas,
  selectRoster,
  useAppSelector,
} from '@/app/store';
import { useWriteOperation, type OperationState } from '@/app/operations';
import { useConfirmation } from '@/app/providers';
import { AdminRouteLink } from '@/app/routing/RouteLink';
import { DonutChart, QuranPageGrid, SegmentBar } from '@/components/charts';
import {
  AppButton,
  NestedSurface,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { AlreadyDistributedError, type DistributionOutcome } from '@/data/distribution';
import { requiredCapacity, resolvePageScope } from '@/domain/assignment';
import { warningLevel, type DistributionMember } from '@/domain/distribution';
import { currentChunk, khatmaProgress } from '@/domain/progress';
import { pickDuaReciter } from '@/domain/rotation';
import {
  activeSeriesGroups,
  nextSeriesNumber,
  seriesTitle,
  type SeriesGroup,
} from '@/domain/series';
import type { Assignment, Khatma, Person } from '@/domain/types';
import { todayIso } from '@/app/admin/todayIso';
import { useQuranScopeMaps, type QuranScopeMaps } from '@/app/admin/useQuranScopeMaps';

/**
 * Admin Home `#/home` (inventory §3.1). One block per active series, one sub-block
 * per active khatma: at-a-glance metrics, pending readers, warnings,
 * and the daily distribute/redistribute action that drives the round model.
 */
export function AdminHomePage() {
  const khatmas = useAppSelector(selectKhatmas);
  const groups = activeSeriesGroups(khatmas);
  // Loaded once for the whole dashboard (distribution needs surah/juz maps).
  const scopeMaps = useQuranScopeMaps();

  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="home">
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.admin.homeHeading}
      </Typography>

      {groups.length === 0 ? (
        // Before the first khatmas snapshot this empty card also shows transiently
        // (no dedicated loading state), matching the legacy dashboard.
        <SurfaceCard>
          <Typography color="text.secondary">{strings.admin.noActive}</Typography>
        </SurfaceCard>
      ) : (
        groups.map((group) => (
          <SeriesBlock
            key={group.seriesId}
            group={group}
            allKhatmas={khatmas}
            scopeMaps={scopeMaps}
          />
        ))
      )}
    </Stack>
  );
}

function SeriesBlock({
  group,
  allKhatmas,
  scopeMaps,
}: {
  group: SeriesGroup;
  allKhatmas: readonly Khatma[];
  scopeMaps: QuranScopeMaps | null;
}) {
  return (
    <SurfaceCard title={seriesTitle(group.latest, toArabicDigits)}>
      <Stack spacing={3}>
        {group.active.map((khatma) => (
          <KhatmaBlock
            key={khatma.id}
            group={group}
            khatma={khatma}
            allKhatmas={allKhatmas}
            scopeMaps={scopeMaps}
          />
        ))}
      </Stack>
    </SurfaceCard>
  );
}

/** Keep one khatma's metrics, readers, warnings, and action visibly together. */
function KhatmaBlock({
  group,
  khatma,
  allKhatmas,
  scopeMaps,
}: {
  group: SeriesGroup;
  khatma: Khatma;
  allKhatmas: readonly Khatma[];
  scopeMaps: QuranScopeMaps | null;
}) {
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatma.id),
  );
  const roster = useAppSelector(selectRoster);

  return (
    <NestedSurface>
      <Stack spacing={3}>
        <KhatmaMetrics khatma={khatma} assignments={assignments} />
        <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />
        <PendingReaders assignments={assignments} roster={roster} />
        <Warnings assignments={assignments} roster={roster} />
        <DistributeAction
          group={group}
          khatma={khatma}
          allKhatmas={allKhatmas}
          roster={roster}
          scopeMaps={scopeMaps}
        />
      </Stack>
    </NestedSurface>
  );
}

/** Donut + segment breakdown + facts line + title link → detail. */
function KhatmaMetrics({
  khatma,
  assignments,
}: {
  khatma: Khatma;
  assignments: readonly Assignment[];
}) {
  const progress = khatmaProgress(khatma, assignments);
  const pendingPages = assignments.reduce(
    (sum, assignment) => sum + (currentChunk(assignment)?.pages.length ?? 0),
    0,
  );
  const facts =
    `${toArabicDigits(khatma.remainingPages.length)} ${strings.admin.pagesRemaining}` +
    ` · ${strings.admin.roundWord} ${toArabicDigits(khatma.roundCount)}` +
    (khatma.lastDistributionDate
      ? ` · ${strings.admin.lastDistribution}: ${khatma.lastDistributionDate}`
      : '');

  return (
    <Stack direction="row" spacing={4} sx={{ alignItems: 'center' }}>
      <DonutChart percent={progress.percent} size={88} />
      <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
        <Link
          component={AdminRouteLink}
          to={{ name: 'khatma', id: khatma.id }}
          underline="always"
          color="primary.main"
          sx={{ alignSelf: 'start', fontWeight: 600 }}
        >
          {seriesTitle(khatma, toArabicDigits)}
        </Link>
        <SegmentBar
          segments={[
            {
              value: progress.donePages,
              color: 'primary',
              label: strings.admin.legendDone,
            },
            {
              value: pendingPages,
              color: 'accent',
              label: strings.admin.legendPending,
            },
            {
              value: khatma.remainingPages.length,
              color: 'neutral',
              label: strings.admin.legendRemaining,
            },
          ]}
        />
        <Typography variant="body2" color="text.secondary">
          {facts}
        </Typography>
      </Stack>
    </Stack>
  );
}

/** Readers still holding a current chunk, with their exact page ranges. */
function PendingReaders({
  assignments,
  roster,
}: {
  assignments: readonly Assignment[];
  roster: readonly Person[];
}) {
  const rows = assignments
    .map((assignment) => ({ assignment, chunk: currentChunk(assignment) }))
    .filter(
      (row): row is { assignment: Assignment; chunk: NonNullable<typeof row.chunk> } =>
        row.chunk !== undefined,
    );
  if (rows.length === 0) return null;

  return (
    <Box
      sx={{
        borderRadius: 1,
        bgcolor: 'background.default',
        p: 3,
        color: 'text.secondary',
      }}
    >
      <Typography sx={{ fontWeight: 600 }}>{strings.admin.pendingHeading}</Typography>
      <Stack
        component="ul"
        spacing={1}
        sx={{ listStyle: 'none', m: 0, mt: 2, p: 0, fontSize: '0.875rem' }}
      >
        {rows.map(({ assignment, chunk }) => (
          <Box
            component="li"
            key={assignment.memberId}
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography component="span" sx={{ fontWeight: 500 }}>
              {memberName(roster, assignment.memberId)}
            </Typography>
            <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {pageRanges(chunk.pages)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

/** Yellow/red warning chips for this khatma — the admin sees every flag. */
function Warnings({
  assignments,
  roster,
}: {
  assignments: readonly Assignment[];
  roster: readonly Person[];
}) {
  const flagged = assignments
    .map((assignment) => ({
      memberId: assignment.memberId,
      level: warningLevel(assignment.missedStreak),
    }))
    .filter((entry) => entry.level !== 'none');
  if (flagged.length === 0) return null;

  return (
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {flagged.map(({ memberId, level }) => (
        <StatusChip
          key={memberId}
          tone={level === 'red' ? 'danger' : 'warning'}
          label={`⚠ ${memberName(roster, memberId)} · ${
            level === 'red'
              ? strings.admin.warningRedWord
              : strings.admin.warningYellowWord
          }`}
        />
      ))}
    </Stack>
  );
}

function memberName(roster: readonly Person[], memberId: string): string {
  return roster.find((person) => person.id === memberId)?.name ?? memberId;
}

/** Compress sorted page numbers into exact Arabic-digit runs: "١–٣، ٥". */
function pageRanges(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length;) {
    const start = sorted[i]!;
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) {
      end = sorted[++i]!;
    }
    ranges.push(
      start === end
        ? toArabicDigits(start)
        : `${toArabicDigits(start)}–${toArabicDigits(end)}`,
    );
    i++;
  }
  return ranges.join('، ');
}

// -----------------------------------------------------------------------------
// The daily distribute / redistribute action.
// -----------------------------------------------------------------------------

/**
 * Per-khatma distribute button. The React twin of the legacy `distributionAction`
 * + `onDistribute` — the injectable `runDistribution` boundary replaces the direct
 * data call, `useConfirmation()` replaces `window.confirm`, and the operation's
 * `isPending` provides the busy-disable (P8). The same-day guard (P7) is a
 * `khatma.lastDistributionDate === todayIso()` check that flips the primary
 * distribute into an outlined redistribute; redistribution bypasses the guard.
 */
function DistributeAction({
  group,
  khatma,
  allKhatmas,
  roster,
  scopeMaps,
}: {
  group: SeriesGroup;
  khatma: Khatma;
  allKhatmas: readonly Khatma[];
  roster: readonly Person[];
  scopeMaps: QuranScopeMaps | null;
}) {
  const distribution = useWriteOperation('runDistribution');
  const { confirm } = useConfirmation();
  const [scopeError, setScopeError] = useState(false);
  // Remember which action produced the current success note (after a distribute
  // the same-day guard flips the button to redistribute, so the button label can
  // no longer tell us what just ran).
  const [lastRedistribute, setLastRedistribute] = useState(false);

  const distributedToday = khatma.lastDistributionDate === todayIso();
  const busy = distribution.isPending;

  const run = async (redistribute: boolean) => {
    const confirmed = await confirm(
      redistribute ? strings.admin.confirmRedistribute : strings.admin.confirmDistribute,
    );
    if (!confirmed) return;

    let pool: number[];
    try {
      pool = resolvePageScope(khatma.scope, scopeMaps?.surahToPages);
    } catch {
      setScopeError(true);
      return;
    }
    setScopeError(false);
    setLastRedistribute(redistribute);

    // Only the newest active khatma seeds the rollover pool; an older overlapping
    // khatma rolls into the existing newer one instead of minting another.
    const isNewestActive = group.active.every(
      (active) => active.seriesNumber <= khatma.seriesNumber,
    );
    await distribution.execute({
      khatmaIds: [khatma.id],
      members: distributionMembers(khatma, roster),
      today: todayIso(),
      unitOfPage: scopeMaps?.pageUnitMaps,
      redistributePages: redistribute,
      rolloverSeed: {
        seriesId: group.seriesId,
        seriesName: group.seriesName,
        ...(group.latest.imageName ? { imageName: group.latest.imageName } : {}),
        seriesNumber: nextSeriesNumber(allKhatmas, group.seriesId),
        totalPages: pool.length,
        scope: khatma.scope,
        memberIds: khatma.memberIds,
        duaReciterId: pickDuaReciter(khatma.memberIds, allKhatmas),
        capacities: khatma.capacities,
        pool: isNewestActive ? pool : [],
      },
    });
  };

  const status = distributionStatus(scopeError, distribution.state, lastRedistribute);

  return (
    <Stack spacing={2}>
      {distributedToday ? (
        <Typography color="success.main" sx={{ fontWeight: 600 }}>
          {strings.admin.distributedToday}
        </Typography>
      ) : null}
      <AppButton
        variant={distributedToday ? 'outlined' : 'contained'}
        disabled={busy}
        onClick={() => void run(distributedToday)}
        sx={{ alignSelf: 'start', ...(busy ? { opacity: 0.5 } : undefined) }}
      >
        {distributedToday ? strings.admin.redistribute : strings.admin.distribute}
      </AppButton>
      {status ? (
        // Intentional a11y delta (inventory §1.7): the legacy shows every status —
        // successes and errors alike — in the same green. Errors get error tone +
        // an `alert` role here so a failed distribution is not announced as success.
        <Typography
          role={status.tone === 'error' ? 'alert' : 'status'}
          color={status.tone === 'error' ? 'error.main' : 'success.main'}
        >
          {status.text}
        </Typography>
      ) : null}
    </Stack>
  );
}

function distributionMembers(
  khatma: Khatma,
  roster: readonly Person[],
): DistributionMember[] {
  return khatma.memberIds
    .map((id) => roster.find((person) => person.id === id))
    .filter((person): person is Person => person !== undefined)
    .map((person) => ({
      id: person.id,
      capacity: requiredCapacity(khatma, person.id),
      completedPages: person.completedPages,
      enabled: person.enabled,
    }));
}

/** Compose the status line + its semantic tone from the operation outcome. */
function distributionStatus(
  scopeError: boolean,
  state: OperationState<DistributionOutcome>,
  lastRedistribute: boolean,
): { text: string; tone: 'success' | 'error' } | null {
  if (scopeError) return { text: strings.admin.distributeError, tone: 'error' };
  if (state.status === 'success') {
    const notes: string[] = [
      lastRedistribute
        ? strings.admin.redistributeSuccess
        : strings.admin.distributeSuccess,
    ];
    if (state.result.rolloverKhatmaId) notes.push(strings.admin.rolloverNote);
    if (state.result.completedKhatmaIds.length > 0)
      notes.push(strings.admin.completedNote);
    return { text: notes.join(' · '), tone: 'success' };
  }
  if (state.status === 'failure') {
    return {
      text:
        state.error instanceof AlreadyDistributedError
          ? strings.admin.alreadyDistributed
          : strings.admin.distributeError,
      tone: 'error',
    };
  }
  return null;
}
