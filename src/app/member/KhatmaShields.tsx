import { Fragment, useId } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { NestedSurface } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import {
  KHATMA_SHIELDS,
  type KhatmaShieldProgress,
  type KhatmaShieldTier,
} from '@/domain/progress';

const arabicPlural = new Intl.PluralRules('ar');

/** Counted noun after a Western digit: plural for 3–10, singular otherwise. */
function khatmaUnit(count: number): string {
  return arabicPlural.select(count) === 'few'
    ? strings.personal.khatmaUnitFew
    : strings.personal.khatmaUnit;
}

/** Western-digit khatma count with its counted noun ("3 ختمات", "11 ختمة"). */
function formatKhatmaCount(count: number): string {
  return `${toWesternDigits(count)} ${khatmaUnit(count)}`;
}

// Heater shield on a 48×56 grid: the rim, then the face inset inside it.
const SHIELD_RIM =
  'M24 2.5 L43.6 9.1 Q45 9.6 45 11.1 V26.5 C45 39.4 36.6 48.5 24.9 53.6 Q24 54 23.1 53.6 C11.4 48.5 3 39.4 3 26.5 V11.1 Q3 9.6 4.4 9.1 Z';
const SHIELD_FACE =
  'M24 7.4 L40.4 12.9 V26.5 C40.4 37 33.7 44.6 24 49 C14.3 44.6 7.6 37 7.6 26.5 V12.9 Z';
const EMBLEM_CENTER = { x: 24, y: 27 } as const;

/** Rub el Hizb outline: two overlapping squares as one 16-vertex star. */
function eightPointStar(radius: number): string {
  const inner = radius * 0.7654; // edge crossing of the two squares
  return Array.from({ length: 16 }, (_, index) => {
    const r = index % 2 === 0 ? radius : inner;
    const angle = (Math.PI / 8) * index - Math.PI / 2;
    const x = EMBLEM_CENTER.x + r * Math.cos(angle);
    const y = EMBLEM_CENTER.y + r * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}
const STAR = eightPointStar(10);
const MINI_STAR = eightPointStar(11.5);

interface KhatmaShieldProps {
  tier: KhatmaShieldTier;
  earned: boolean;
  /** Rendered width in px; the height follows the shield's 48×56 grid. */
  size: number;
  /** A locked shield prints this khatma target on its face. */
  threshold?: number;
  /** Accessible name. Omit for a decorative shield. */
  label?: string;
  /** Periodic light sweep across an earned face. */
  shine?: boolean;
  shineDelay?: string;
}

function KhatmaShield({
  tier,
  earned,
  size,
  threshold,
  label,
  shine = false,
  shineDelay = '0s',
}: KhatmaShieldProps) {
  const theme = useTheme();
  const medal = theme.custom.medals[tier];
  const id = `shield-${useId().replace(/[^\w-]/g, '')}`;

  return (
    <svg
      viewBox="0 0 48 56"
      width={size}
      height={(size * 56) / 48}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: 'block',
        overflow: 'visible',
        filter: earned ? `drop-shadow(0 3px 6px ${alpha(medal.lo, 0.35)})` : undefined,
      }}
    >
      {earned ? (
        <>
          <defs>
            <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={medal.hi} />
              <stop offset="0.45" stopColor={medal.mid} />
              <stop offset="1" stopColor={medal.lo} />
            </linearGradient>
            <linearGradient id={`${id}-face`} x1="1" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor={medal.hi} />
              <stop offset="0.6" stopColor={medal.mid} />
              <stop offset="1" stopColor={medal.lo} />
            </linearGradient>
            <linearGradient id={`${id}-glint`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.3" stopColor={medal.hi} stopOpacity="0" />
              <stop offset="0.5" stopColor={medal.hi} stopOpacity="0.85" />
              <stop offset="0.7" stopColor={medal.hi} stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              <path d={SHIELD_RIM} />
            </clipPath>
          </defs>
          <path d={SHIELD_RIM} fill={`url(#${id}-rim)`} />
          <path
            d={SHIELD_FACE}
            fill={`url(#${id}-face)`}
            stroke={medal.hi}
            strokeOpacity={0.7}
            strokeWidth={0.8}
          />
          <polygon
            points={STAR}
            fill={medal.hi}
            stroke={medal.lo}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          {/* The ring at the heart of ۞. */}
          <circle
            cx={EMBLEM_CENTER.x}
            cy={EMBLEM_CENTER.y}
            r={3.4}
            fill="none"
            stroke={medal.lo}
            strokeWidth={1.1}
          />
          {shine ? (
            <g clipPath={`url(#${id}-clip)`}>
              <rect
                width={48}
                height={56}
                fill={`url(#${id}-glint)`}
                // Parked off-face at rest, so reduced motion shows no band.
                style={{
                  transformBox: 'fill-box',
                  transform: 'translateX(-100%)',
                  animation: `glint ${theme.custom.motion.shimmer} ${theme.custom.motion.easingSoft} ${shineDelay} infinite`,
                }}
              />
            </g>
          ) : null}
        </>
      ) : (
        <>
          <path d={SHIELD_RIM} fill={theme.custom.cellRem} />
          <path
            d={SHIELD_FACE}
            fill={theme.custom.medalCenter}
            stroke={theme.palette.divider}
            strokeWidth={0.8}
          />
          {threshold !== undefined ? (
            <text
              x={EMBLEM_CENTER.x}
              y={EMBLEM_CENTER.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-ui)"
              fontSize={threshold >= 10 ? 14 : 16}
              fontWeight={800}
              fill={theme.palette.text.secondary}
            >
              {toWesternDigits(threshold)}
            </text>
          ) : (
            <polygon
              points={MINI_STAR}
              fill="none"
              stroke={theme.palette.text.secondary}
              strokeOpacity={0.45}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          )}
        </>
      )}
    </svg>
  );
}

/** Corner counter of whole Qurans read, wearing the highest shield earned. */
export function KhatmaCountBadge({
  count,
  tier,
}: {
  count: number;
  tier: KhatmaShieldTier | undefined;
}) {
  return (
    <Box
      role="group"
      aria-label={strings.personal.fullKhatmas}
      sx={(theme) => {
        const medal = tier ? theme.custom.medals[tier] : undefined;
        return {
          flex: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1,
          borderRadius: `${theme.custom.radii.pill}px`,
          border: `1px solid ${medal ? alpha(medal.mid, 0.5) : theme.palette.divider}`,
          bgcolor: medal ? alpha(medal.mid, 0.14) : 'background.default',
        };
      }}
    >
      <KhatmaShield tier={tier ?? 'bronze'} earned={tier !== undefined} size={20} />
      <Typography
        component="span"
        sx={{
          fontSize: '1.25rem',
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {toWesternDigits(count)}
      </Typography>
      <Typography component="span" variant="body2" color="text.secondary">
        {khatmaUnit(count)}
      </Typography>
    </Box>
  );
}

/** Bronze → silver → gold path with the step fills and the next goal. */
export function KhatmaShieldTrack({ progress }: { progress: KhatmaShieldProgress }) {
  const headingId = `shields-${useId().replace(/[^\w-]/g, '')}`;
  const currentIndex = KHATMA_SHIELDS.findIndex(
    (shield) => shield.tier === progress.current,
  );
  const status = progress.next
    ? strings.personal.shieldNext
        .replace('{count}', formatKhatmaCount(progress.next.remainingKhatmas))
        .replace('{shield}', strings.personal.shieldNames[progress.next.tier])
    : strings.personal.shieldAllEarned;

  return (
    <NestedSurface aria-labelledby={headingId}>
      <Stack spacing={3}>
        <Typography
          id={headingId}
          component="h3"
          variant="body1"
          sx={{ fontWeight: 800 }}
        >
          {strings.personal.shieldsHeading}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(16px, 1fr) auto minmax(16px, 1fr) auto',
            alignItems: 'start',
            columnGap: 1,
          }}
        >
          {KHATMA_SHIELDS.map((shield, index) => {
            const earned = index <= currentIndex;
            const isCurrent = index === currentIndex;
            const size = isCurrent ? 60 : 52;
            return (
              <Fragment key={shield.tier}>
                {index > 0 ? (
                  <ShieldStep
                    from={KHATMA_SHIELDS[index - 1]!.tier}
                    to={shield.tier}
                    fill={progress.steps[index - 1] ?? 0}
                  />
                ) : null}
                <Stack spacing={1} sx={{ alignItems: 'center', minWidth: 64 }}>
                  <Box
                    sx={{
                      height: (60 * 56) / 48,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <KhatmaShield
                      tier={shield.tier}
                      earned={earned}
                      size={size}
                      threshold={shield.khatmas}
                      label={`${strings.personal.shieldNames[shield.tier]}، ${
                        earned
                          ? strings.personal.shieldEarned
                          : strings.personal.shieldLocked
                      }`}
                      shine={earned}
                      shineDelay={`${index * 0.6}s`}
                    />
                  </Box>
                  <Typography
                    component="span"
                    variant="body2"
                    color={earned ? 'text.primary' : 'text.secondary'}
                    sx={{ fontWeight: 800, lineHeight: 1.2 }}
                  >
                    {strings.personal.shieldTiers[shield.tier]}
                  </Typography>
                  <Typography component="span" variant="caption" color="text.secondary">
                    {formatKhatmaCount(shield.khatmas)}
                  </Typography>
                </Stack>
              </Fragment>
            );
          })}
        </Box>
        <Typography component="p" variant="body2" color="text.secondary">
          {status}
        </Typography>
      </Stack>
    </NestedSurface>
  );
}

/** Track between two shields, filling from the lower metal toward the next. */
function ShieldStep({
  from,
  to,
  fill,
}: {
  from: KhatmaShieldTier;
  to: KhatmaShieldTier;
  fill: number;
}) {
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        // Centre the 6px track on the tallest (current) shield.
        mt: `${(60 * 56) / 48 / 2 - 3}px`,
        height: 6,
        borderRadius: `${theme.custom.radii.pill}px`,
        bgcolor: theme.custom.cellRem,
        overflow: 'hidden',
      })}
    >
      <Box
        sx={(theme) => ({
          width: `${Math.round(fill * 100)}%`,
          height: '100%',
          borderRadius: 'inherit',
          // RTL fills from the right, so the lower metal sits on the right end.
          background: `linear-gradient(90deg, ${theme.custom.medals[to].lo}, ${theme.custom.medals[from].mid})`,
          transition: `width ${theme.custom.motion.slow} ${theme.custom.motion.easing}`,
        })}
      />
    </Box>
  );
}
