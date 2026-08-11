import type { ReactNode } from 'react';
import { shallowEqual } from 'react-redux';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectKhatmas,
  selectRoster,
  useAppSelector,
} from '@/app/store';
import { AdminRouteLink } from '@/app/routing/RouteLink';
import { DonutChart, QuranPageGrid, SegmentBar } from '@/components/charts';
import { NestedSurface, StatusChip, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import { warningLevel } from '@/domain/distribution';
import { personAvatar } from '@/domain/personAppearance';
import {
  currentChunk,
  khatmaProgress,
  roundReaderRecords,
  type RoundReaderRecord,
} from '@/domain/progress';
import { activeSeriesGroups, seriesTitle, type SeriesGroup } from '@/domain/series';
import type { Assignment, Khatma, Person } from '@/domain/types';
import { useQuranScopeMaps, type QuranScopeMaps } from '@/app/admin/useQuranScopeMaps';
import { DistributionPlannerDialog } from '@/app/admin/distribution/DistributionPlannerDialog';

/**
 * Admin Home `#/home` (current UI contract). One block per active series, one sub-block
 * per active khatma: at-a-glance metrics, pending readers, warnings,
 * and the series-level preview/adjust/confirm controls that drive the round model.
 */
export function AdminHomePage() {
  const khatmas = useAppSelector(selectKhatmas);
  const groups = activeSeriesGroups(khatmas);
  // Loaded once for the whole dashboard (distribution needs surah/juz maps).
  const scopeMaps = useQuranScopeMaps();

  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="home">
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
  const roster = useAppSelector(selectRoster);
  const assignmentsByKhatma = useAppSelector(
    (state) =>
      Object.fromEntries(
        group.active.map((khatma) => [
          khatma.id,
          selectAssignmentsForKhatma(state, khatma.id),
        ]),
      ),
    shallowEqual,
  );
  const assignmentsReady = useAppSelector((state) =>
    group.active.every(
      (khatma) => selectAssignmentsListener(state, khatma.id)?.status === 'ready',
    ),
  );
  return (
    <SurfaceCard title={seriesTitle(group.latest, toWesternDigits)}>
      <Stack spacing={3}>
        {group.active.map((khatma) => (
          <KhatmaBlock key={khatma.id} khatma={khatma} />
        ))}
        <DistributionPlannerDialog
          group={group}
          allKhatmas={allKhatmas}
          roster={roster}
          assignmentsByKhatma={assignmentsByKhatma}
          assignmentsReady={assignmentsReady}
          scopeMaps={scopeMaps}
        />
      </Stack>
    </SurfaceCard>
  );
}

/** Keep one khatma's metrics, readers, and warnings visibly together. */
function KhatmaBlock({ khatma }: { khatma: Khatma }) {
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatma.id),
  );
  const roster = useAppSelector(selectRoster);

  return (
    <NestedSurface>
      <Stack spacing={3}>
        <KhatmaMetrics khatma={khatma} assignments={assignments} />
        <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />
        <RoundReadingStatus assignments={assignments} roster={roster} />
        <Warnings assignments={assignments} roster={roster} />
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
    `${toWesternDigits(khatma.remainingPages.length)} ${strings.admin.pagesRemaining}` +
    ` · ${strings.admin.roundWord} ${toWesternDigits(khatma.roundCount)}` +
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
          {seriesTitle(khatma, toWesternDigits)}
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

/** Each member's latest completed or pending assignment, collapsed by status. */
function RoundReadingStatus({
  assignments,
  roster,
}: {
  assignments: readonly Assignment[];
  roster: readonly Person[];
}) {
  const records = roundReaderRecords(assignments);

  return (
    <Stack spacing={2}>
      <ReaderStatusAccordion
        title={strings.admin.pendingHeading}
        icon={<AccessTimeRoundedIcon color="action" fontSize="small" />}
        records={records.pending}
        roster={roster}
        showRound
      />
      <ReaderStatusAccordion
        title={strings.admin.completedPagesHeading}
        icon={<CheckCircleRoundedIcon color="success" fontSize="small" />}
        records={records.completed}
        roster={roster}
        showRound
      />
    </Stack>
  );
}

function ReaderStatusAccordion({
  title,
  icon,
  records,
  roster,
  showRound = false,
}: {
  title: string;
  icon: ReactNode;
  records: readonly RoundReaderRecord[];
  roster: readonly Person[];
  showRound?: boolean;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={(theme) => ({
        border: 1,
        borderColor: 'divider',
        borderRadius: `${theme.custom.radii.button}px !important`,
        bgcolor: 'background.default',
        boxShadow: 'none',
        '&:before': { display: 'none' },
      })}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        sx={{ minHeight: 52, px: 3, '& .MuiAccordionSummary-content': { my: 2 } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {icon}
          <Typography sx={{ fontWeight: 600 }}>
            {title} ({toWesternDigits(records.length)})
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 3, pt: 0, pb: 3 }}>
        {records.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {strings.feedback.empty}
          </Typography>
        ) : (
          <Stack
            component="ul"
            spacing={1}
            sx={{ listStyle: 'none', m: 0, p: 0, fontSize: '0.875rem' }}
          >
            {records.map((record) => (
              <Box
                component="li"
                key={`${record.memberId}:${record.round}`}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <MemberIdentity roster={roster} memberId={record.memberId} />
                <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {showRound
                    ? `${strings.admin.roundWord} ${toWesternDigits(record.round)} · `
                    : ''}
                  {pageRanges(record.pages)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

/** Collapsed yellow/red warning chips for this khatma. */
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
    <Accordion
      disableGutters
      elevation={0}
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={(theme) => ({
        border: 1,
        borderColor: 'divider',
        borderRadius: `${theme.custom.radii.button}px !important`,
        bgcolor: 'background.default',
        boxShadow: 'none',
        '&:before': { display: 'none' },
      })}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        sx={{ minHeight: 52, px: 3, '& .MuiAccordionSummary-content': { my: 2 } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <WarningAmberRoundedIcon color="warning" fontSize="small" />
          <Typography sx={{ fontWeight: 600 }}>
            {strings.admin.warningsHeading} ({toWesternDigits(flagged.length)})
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 3, pt: 0, pb: 3 }}>
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
      </AccordionDetails>
    </Accordion>
  );
}

function MemberIdentity({
  roster,
  memberId,
}: {
  roster: readonly Person[];
  memberId: string;
}) {
  const person = roster.find((candidate) => candidate.id === memberId);
  const name = person?.name ?? memberId;
  const avatar = person ? personAvatar(person) : '?';
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Avatar
        component="span"
        role="img"
        aria-label={`${name}: ${avatar}`}
        sx={{ width: 30, height: 30, fontSize: '0.8rem' }}
      >
        {avatar}
      </Avatar>
      <Typography component="span" sx={{ minWidth: 0, fontWeight: 500 }}>
        {name}
      </Typography>
    </Stack>
  );
}

function memberName(roster: readonly Person[], memberId: string): string {
  return roster.find((person) => person.id === memberId)?.name ?? memberId;
}

/** Compress sorted page numbers into exact Western-digit runs: "1–3، 5". */
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
        ? toWesternDigits(start)
        : `${toWesternDigits(start)}–${toWesternDigits(end)}`,
    );
    i++;
  }
  return ranges.join('، ');
}
