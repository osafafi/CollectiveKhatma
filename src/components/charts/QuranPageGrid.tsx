import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import type { Assignment, Khatma, Person } from '@/domain/types';
import {
  buildQuranPageEntries,
  pageFocusScale,
  type QuranPageEntry,
  type QuranPageState,
} from './quranPageGridModel';

const DEFAULT_COLUMNS = 24;
const DEFAULT_NEIGHBOR_COUNT = 2;
const DEFAULT_MAX_SCALE = 3.2;
const DEFAULT_LONG_PRESS_MS = 360;
const PRESS_MOVE_TOLERANCE = 10;

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const;

interface ActivePress {
  pointerId: number;
  index: number;
  x: number;
  y: number;
}

export interface QuranPageGridProps {
  khatma: Khatma;
  assignments: readonly Assignment[];
  roster: readonly Person[];
  /** Number of boxes on each horizontal side that share the scale effect. */
  neighborCount?: number;
  /** Exposed for tuning and deterministic interaction tests. */
  longPressMs?: number;
}

/**
 * Collapsible, touch-first page map. A long press magnifies the selected page
 * and its horizontal neighbors without reflowing the grid.
 */
export function QuranPageGrid({
  khatma,
  assignments,
  roster,
  neighborCount = DEFAULT_NEIGHBOR_COUNT,
  longPressMs = DEFAULT_LONG_PRESS_MS,
}: QuranPageGridProps) {
  const entries = useMemo(
    () => buildQuranPageEntries(khatma, assignments),
    [assignments, khatma],
  );
  const namesById = useMemo(
    () => new Map(roster.map((person) => [person.id, person.name])),
    [roster],
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const activePress = useRef<ActivePress | null>(null);
  const generatedId = useId().replace(/:/g, '');
  const detailsId = `quran-page-map-${generatedId}`;
  const activeEntry = activeIndex === null ? undefined : entries[activeIndex];

  useEffect(
    () => () => {
      if (pressTimer.current !== undefined) window.clearTimeout(pressTimer.current);
    },
    [],
  );

  const stopPress = () => {
    if (pressTimer.current !== undefined) window.clearTimeout(pressTimer.current);
    pressTimer.current = undefined;
    activePress.current = null;
    setActiveIndex(null);
  };

  const startPress = (event: PointerEvent<HTMLElement>, index: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopPress();
    activePress.current = {
      pointerId: event.pointerId,
      index,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressTimer.current = window.setTimeout(
      () => {
        setActiveIndex(index);
        pressTimer.current = undefined;
      },
      Math.max(0, longPressMs),
    );
  };

  const movePress = (event: PointerEvent<HTMLElement>) => {
    const press = activePress.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (
      Math.abs(event.clientX - press.x) > PRESS_MOVE_TOLERANCE ||
      Math.abs(event.clientY - press.y) > PRESS_MOVE_TOLERANCE
    ) {
      stopPress();
    }
  };

  const endPress = (event: PointerEvent<HTMLElement>) => {
    if (activePress.current?.pointerId === event.pointerId) stopPress();
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = activeIndex ?? 0;
    let next: number | null;
    switch (event.key) {
      case 'ArrowLeft':
        next = Math.min(entries.length - 1, current + 1);
        break;
      case 'ArrowRight':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = entries.length - 1;
        break;
      case 'Escape':
        next = null;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActiveIndex(next);
  };

  const counts = countStates(entries);

  return (
    <Accordion
      disableGutters
      elevation={0}
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: '12px !important',
        bgcolor: 'background.default',
        boxShadow: 'none',
        overflow: 'visible',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        id={`${detailsId}-summary`}
        aria-controls={detailsId}
        aria-label={strings.admin.pageMapHeading}
        expandIcon={<ExpandMoreRoundedIcon />}
        sx={{
          minHeight: 52,
          px: 3,
          '& .MuiAccordionSummary-content': { my: 2 },
        }}
      >
        <Stack spacing={0.5}>
          <Typography sx={{ fontWeight: 600 }}>{strings.admin.pageMapHeading}</Typography>
          <Typography variant="caption" color="text.secondary">
            {strings.admin.pageMapHoldHint}
          </Typography>
        </Stack>
      </AccordionSummary>

      <AccordionDetails
        id={detailsId}
        aria-labelledby={`${detailsId}-summary`}
        sx={{ px: 3, pt: 1, pb: 4 }}
      >
        <Stack spacing={3}>
          <PageMapLegend counts={counts} />
          <Box
            role="grid"
            tabIndex={0}
            aria-label={`${strings.admin.pageMapHeading}. ${strings.admin.pageMapKeyboardHint}`}
            data-testid="quran-page-grid"
            onFocus={() =>
              setActiveIndex((index) => index ?? (entries.length ? 0 : null))
            }
            onBlur={stopPress}
            onKeyDown={onGridKeyDown}
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${DEFAULT_COLUMNS}, minmax(0, 1fr))`,
              gap: '3px',
              width: '100%',
              maxWidth: 560,
              mx: 'auto',
              p: 3,
              touchAction: 'pan-y',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              borderRadius: 2,
            }}
          >
            {entries.map((entry, index) => {
              const scale = pageFocusScale(
                index,
                activeIndex,
                neighborCount,
                DEFAULT_COLUMNS,
                DEFAULT_MAX_SCALE,
              );
              const active = index === activeIndex;
              const distance = activeIndex === null ? 0 : Math.abs(index - activeIndex);
              const memberName = entry.memberId
                ? (namesById.get(entry.memberId) ?? entry.memberId)
                : undefined;

              return (
                <Box
                  component="span"
                  role="gridcell"
                  aria-hidden="true"
                  key={entry.page}
                  data-page={entry.page}
                  data-page-state={entry.state}
                  data-scale={scale.toFixed(3)}
                  data-active={active ? 'true' : undefined}
                  onPointerDown={(event) => startPress(event, index)}
                  onPointerMove={movePress}
                  onPointerUp={endPress}
                  onPointerCancel={endPress}
                  onLostPointerCapture={endPress}
                  onContextMenu={(event) => event.preventDefault()}
                  sx={{
                    position: 'relative',
                    display: 'block',
                    aspectRatio: '1',
                    minWidth: 0,
                    borderRadius: '2px',
                    bgcolor: pageColor(entry.state),
                    border: '1px solid',
                    borderColor: pageBorderColor(entry.state),
                    transform: `scale(${scale})`,
                    transformOrigin: 'center',
                    transition: 'transform 130ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                    zIndex: scale > 1 ? neighborCount + 2 - distance : 0,
                    overflow: 'visible',
                  }}
                >
                  {active ? (
                    <Box
                      component="span"
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        display: 'block',
                        maxWidth: 'none',
                        color: pageTextColor(entry.state),
                        bgcolor: pageLabelColor(entry.state),
                        border: '1px solid',
                        borderColor: pageBorderColor(entry.state),
                        borderRadius: '3px',
                        boxShadow: '0 1px 3px rgb(38 49 43 / 22%)',
                        px: 0.75,
                        py: 0.5,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        transform: `translate(-50%, -50%) rotate(-38deg) scale(${1 / DEFAULT_MAX_SCALE})`,
                        transformOrigin: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      {memberName
                        ? `${toArabicDigits(entry.page)} · ${memberName}`
                        : toArabicDigits(entry.page)}
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Box>

          <Box role="status" aria-live="polite" sx={visuallyHidden}>
            {activeEntry ? pageDescription(activeEntry, namesById) : ''}
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function countStates(entries: readonly QuranPageEntry[]): Record<QuranPageState, number> {
  const counts: Record<QuranPageState, number> = {
    done: 0,
    assigned: 0,
    remaining: 0,
  };
  for (const entry of entries) counts[entry.state]++;
  return counts;
}

function PageMapLegend({ counts }: { counts: Record<QuranPageState, number> }) {
  const items: ReadonlyArray<{ state: QuranPageState; label: string }> = [
    { state: 'done', label: strings.admin.legendDone },
    { state: 'assigned', label: strings.admin.legendPending },
    { state: 'remaining', label: strings.admin.legendRemaining },
  ];

  return (
    <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {items.map(({ state, label }) => (
        <Stack key={state} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box
            component="span"
            aria-hidden="true"
            sx={{
              width: 10,
              height: 10,
              borderRadius: '2px',
              bgcolor: pageColor(state),
              border: '1px solid',
              borderColor: pageBorderColor(state),
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {`${label}: ${toArabicDigits(counts[state])}`}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function pageColor(state: QuranPageState): string {
  switch (state) {
    case 'done':
      return 'primary.main';
    case 'assigned':
      return 'secondary.main';
    case 'remaining':
      return 'grey.300';
  }
}

function pageBorderColor(state: QuranPageState): string {
  switch (state) {
    case 'done':
      return 'primary.dark';
    case 'assigned':
      return 'secondary.dark';
    case 'remaining':
      return 'grey.400';
  }
}

function pageTextColor(state: QuranPageState): string {
  return state === 'done' ? 'primary.contrastText' : 'text.primary';
}

function pageLabelColor(state: QuranPageState): string {
  switch (state) {
    case 'done':
      return 'primary.dark';
    case 'assigned':
      return 'secondary.main';
    case 'remaining':
      return 'grey.100';
  }
}

function pageDescription(
  entry: QuranPageEntry,
  namesById: ReadonlyMap<string, string>,
): string {
  const stateLabel =
    entry.state === 'done'
      ? strings.admin.legendDone
      : entry.state === 'assigned'
        ? strings.admin.legendPending
        : strings.admin.legendRemaining;
  const memberName = entry.memberId
    ? (namesById.get(entry.memberId) ?? entry.memberId)
    : undefined;
  return `${strings.admin.pageWord} ${toArabicDigits(entry.page)}، ${stateLabel}${
    memberName ? `، ${memberName}` : ''
  }`;
}
