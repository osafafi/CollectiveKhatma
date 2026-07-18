import { Typography } from '@mui/material';
import { QuranPageGrid } from '@/components/charts';
import { ProgressView, SurfaceCard } from '@/components/primitives';
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

  return (
    <SurfaceCard title={strings.member.groupProgress}>
      <ProgressView
        value={progress.percent}
        label={strings.member.groupProgress}
        valueText={percent}
      />
      {inRound.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          {strings.member.completedRoundCount}: {toArabicDigits(doneCount)}{' '}
          {strings.member.ofWord} {toArabicDigits(inRound.length)}
        </Typography>
      ) : null}
      {pendingNames.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          ⏳ {pendingNames.join('، ')}
        </Typography>
      ) : null}
      <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />
    </SurfaceCard>
  );
}
