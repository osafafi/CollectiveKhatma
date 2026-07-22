import { useMemo, useState } from 'react';
import { Typography } from '@mui/material';
import { QuranPageGrid, SegmentBar, buildQuranPageEntries } from '@/components/charts';
import { CollapsibleCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { isRoundDone, khatmaProgress, pendingReaders } from '@/domain/progress';
import type { Assignment, Khatma, Person } from '@/domain/types';

interface GroupProgressCardProps {
  khatma: Khatma;
  assignments: readonly Assignment[];
  roster: readonly Person[];
}

export function GroupProgressCard({
  khatma,
  assignments,
  roster,
}: GroupProgressCardProps) {
  // Local disclosure — the design (2a) opens group progress by default.
  const [open, setOpen] = useState(true);
  const progress = khatmaProgress(khatma, assignments);
  const inRound = assignments.filter((assignment) =>
    assignment.rounds.some(
      (chunk) =>
        chunk.round === khatma.roundCount &&
        chunk.pages.length > 0 &&
        chunk.released !== true,
    ),
  );
  const doneCount = inRound.filter((assignment) =>
    isRoundDone(assignment, khatma.roundCount),
  ).length;
  const pendingNames = pendingReaders(assignments)
    .map((id) => roster.find((person) => person.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const percent = `${toArabicDigits(progress.percent)}٪`;

  // Page-state counts feed the design's read / being-read / remaining bar.
  const counts = useMemo(() => {
    const entries = buildQuranPageEntries(khatma, assignments);
    const result = { done: 0, assigned: 0, remaining: 0 };
    for (const entry of entries) result[entry.state] += 1;
    return result;
  }, [khatma, assignments]);

  return (
    <CollapsibleCard
      title={strings.member.groupProgress}
      open={open}
      onOpenChange={setOpen}
      appear={1}
      summaryEnd={
        <Typography
          component="span"
          color="primary.main"
          sx={{
            fontSize: '1.25rem',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
          }}
          aria-label={`${strings.member.groupProgress}: ${percent}`}
        >
          {percent}
        </Typography>
      }
    >
      <SegmentBar
        segments={[
          { value: counts.done, color: 'primary', label: strings.admin.legendDone },
          { value: counts.assigned, color: 'accent', label: strings.admin.legendPending },
          {
            value: counts.remaining,
            color: 'neutral',
            label: strings.admin.legendRemaining,
          },
        ]}
      />
      {inRound.length > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          {strings.member.completedRoundCount}: {toArabicDigits(doneCount)}{' '}
          {strings.member.ofWord} {toArabicDigits(inRound.length)}
        </Typography>
      ) : null}
      {pendingNames.length > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          ⏳ {pendingNames.join('، ')}
        </Typography>
      ) : null}
      <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />
    </CollapsibleCard>
  );
}
