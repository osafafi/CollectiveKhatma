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
import { personAvatar } from '@/domain/personAppearance';
import type { Assignment, Khatma, Person } from '@/domain/types';
import { tokens } from '@/theme/muiTheme';
import {
  buildQuranPageEntries,
  pageIndexAtGridPoint,
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
  target: HTMLElement;
  activated: boolean;
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
  const peopleById = useMemo(
    () => new Map(roster.map((person) => [person.id, person])),
    [roster],
  );
  const namesById = useMemo(
    () => new Map(roster.map((person) => [person.id, person.name])),
    [roster],
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const activePress = useRef<ActivePress | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
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
    const press = activePress.current;
    activePress.current = null;
    if (press?.target.hasPointerCapture?.(press.pointerId)) {
      press.target.releasePointerCapture(press.pointerId);
    }
    setActiveIndex(null);
  };

  const startPress = (event: PointerEvent<HTMLElement>, index: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopPress();
    const pointerId = event.pointerId;
    activePress.current = {
      pointerId,
      index,
      x: event.clientX,
      y: event.clientY,
      target: event.currentTarget,
      activated: false,
    };
    pressTimer.current = window.setTimeout(
      () => {
        const press = activePress.current;
        if (!press || press.pointerId !== pointerId) return;
        press.activated = true;
        press.target.setPointerCapture?.(press.pointerId);
        setActiveIndex(press.index);
        pressTimer.current = undefined;
      },
      Math.max(0, longPressMs),
    );
  };

  const movePress = (event: PointerEvent<HTMLElement>) => {
    const press = activePress.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (!press.activated) {
      if (
        Math.abs(event.clientX - press.x) > PRESS_MOVE_TOLERANCE ||
        Math.abs(event.clientY - press.y) > PRESS_MOVE_TOLERANCE
      ) {
        stopPress();
      }
      return;
    }

    event.preventDefault();
    const nextIndex = pageIndexFromPointer(
      gridRef.current,
      event.clientX,
      event.clientY,
      entries.length,
    );
    if (nextIndex !== null) setActiveIndex(nextIndex);
  };

  const endPress = (event: PointerEvent<HTMLElement>) => {
    if (activePress.current?.pointerId === event.pointerId) stopPress();
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = activeIndex ?? (event.key === 'ArrowLeft' ? -1 : 0);
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
            ref={gridRef}
            tabIndex={0}
            aria-label={`${strings.admin.pageMapHeading}. ${strings.admin.pageMapKeyboardHint}`}
            data-testid="quran-page-grid"
            onBlur={stopPress}
            onKeyDown={onGridKeyDown}
            onPointerMove={movePress}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onContextMenu={(event) => event.preventDefault()}
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${DEFAULT_COLUMNS}, minmax(0, 1fr))`,
              gap: '3px',
              width: '100%',
              maxWidth: 560,
              mx: 'auto',
              p: 3,
              touchAction: activeIndex === null ? 'pan-y' : 'none',
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
              const member = entry.memberId ? peopleById.get(entry.memberId) : undefined;
              const memberName = member?.name ?? entry.memberId;
              const avatar = member ? personAvatar(member) : undefined;
              const usesEmoji = Boolean(member?.emoji?.trim());

              return (
                <Box
                  component="span"
                  role="gridcell"
                  aria-hidden="true"
                  key={entry.page}
                  data-page={entry.page}
                  data-page-state={entry.state}
                  data-member-id={entry.memberId}
                  data-scale={scale.toFixed(3)}
                  data-active={active ? 'true' : undefined}
                  onPointerDown={(event) => startPress(event, index)}
                  onLostPointerCapture={endPress}
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
                  ) : avatar ? (
                    <Box
                      component="span"
                      data-reader-avatar={avatar}
                      data-avatar-source={usesEmoji ? 'emoji' : 'initials'}
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: pageTextColor(entry.state),
                        fontFamily: usesEmoji ? 'system-ui, sans-serif' : 'inherit',
                        fontSize: usesEmoji
                          ? 'clamp(0.4rem, 1.7vw, 0.68rem)'
                          : 'clamp(0.32rem, 1.35vw, 0.52rem)',
                        fontWeight: usesEmoji ? 400 : 800,
                        letterSpacing: usesEmoji ? 0 : '-0.08em',
                        lineHeight: 1,
                        overflow: 'hidden',
                        pointerEvents: 'none',
                      }}
                    >
                      {avatar}
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

function pageIndexFromPointer(
  grid: HTMLDivElement | null,
  clientX: number,
  clientY: number,
  pageCount: number,
): number | null {
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  const style = window.getComputedStyle(grid);
  const pixels = (value: string): number => Number.parseFloat(value) || 0;
  return pageIndexAtGridPoint(clientX, clientY, pageCount, DEFAULT_COLUMNS, {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    paddingLeft: pixels(style.paddingLeft),
    paddingRight: pixels(style.paddingRight),
    paddingTop: pixels(style.paddingTop),
    columnGap: pixels(style.columnGap),
    rowGap: pixels(style.rowGap),
    direction: style.direction === 'rtl' ? 'rtl' : 'ltr',
  });
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
      return tokens.color.primary;
    case 'assigned':
      return tokens.color.accent;
    case 'remaining':
      return 'grey.300';
  }
}

function pageBorderColor(state: QuranPageState): string {
  switch (state) {
    case 'done':
      return tokens.color.primaryStrong;
    case 'assigned':
      return mixHex(tokens.color.accent, tokens.color.ink, 0.24);
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
      return pageBorderColor(state);
    case 'assigned':
      return pageColor(state);
    case 'remaining':
      return 'grey.100';
  }
}

/** Blend two semantic theme colors. */
function mixHex(baseColor: string, tintColor: string, tintWeight: number): string {
  const base = hexChannels(baseColor);
  const tint = hexChannels(tintColor);
  if (!base || !tint) return baseColor;
  const weight = Math.max(0, Math.min(1, tintWeight));
  return `#${base
    .map((channel, index) =>
      Math.round(channel * (1 - weight) + (tint[index] ?? channel) * weight)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function hexChannels(color: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return undefined;
  return [
    Number.parseInt(match[1]!, 16),
    Number.parseInt(match[2]!, 16),
    Number.parseInt(match[3]!, 16),
  ];
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
