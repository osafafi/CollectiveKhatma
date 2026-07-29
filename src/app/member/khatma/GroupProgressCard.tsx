import { useMemo, useState } from 'react';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Typography,
} from '@mui/material';
import { QuranPageGrid, SegmentBar, buildQuranPageEntries } from '@/components/charts';
import { CollapsibleCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { personAvatar } from '@/domain/personAppearance';
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
  const pendingPeople = pendingReaders(assignments)
    .map((id) => roster.find((person) => person.id === id))
    .filter((person): person is Person => person !== undefined);
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
      title={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}
        >
          <GroupsRoundedIcon color="primary" fontSize="small" />
          <Box component="span">{strings.member.groupProgress}</Box>
        </Box>
      }
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
      {pendingPeople.length > 0 ? (
        <PendingReadersDisclosure people={pendingPeople} />
      ) : null}
      <QuranPageGrid khatma={khatma} assignments={assignments} roster={roster} />
    </CollapsibleCard>
  );
}

function PendingReadersDisclosure({ people }: { people: readonly Person[] }) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={(theme) => ({
        mt: 2,
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccessTimeRoundedIcon color="action" fontSize="small" />
          <Typography sx={{ fontWeight: 600 }}>
            {strings.member.pendingReadersHeading} ({toArabicDigits(people.length)})
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 3, pt: 0, pb: 3 }}>
        <Box
          component="ul"
          aria-label={strings.member.pendingReadersHeading}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 2,
            listStyle: 'none',
            m: 0,
            p: 0,
          }}
        >
          {people.map((person) => {
            const avatar = personAvatar(person);
            return (
              <Box
                component="li"
                key={person.id}
                sx={(theme) => ({
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  borderRadius: `${theme.custom.radii.button}px`,
                  bgcolor: 'background.paper',
                  px: 2,
                  py: 1.5,
                })}
              >
                <Avatar
                  component="span"
                  role="img"
                  aria-label={`${person.name}: ${avatar}`}
                  sx={{ width: 30, height: 30, fontSize: '0.8rem', flex: 'none' }}
                >
                  {avatar}
                </Avatar>
                <Typography
                  component="span"
                  sx={{
                    minWidth: 0,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {person.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
