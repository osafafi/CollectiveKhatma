import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '@/components/primitives/mergeSx';
import { heroBleedSx } from './layoutContracts';

export interface HeroHeaderProps {
  /** Small line above the title (greeting / section label). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /**
   * Semantic element for the title. Defaults to a plain div so pages keep
   * owning their `h1`; pass `h1` when the hero IS the page heading.
   */
  titleComponent?: 'h1' | 'div';
  /** Floating avatar chip content (initials/emoji) rendered before the texts. */
  avatar?: ReactNode;
  /**
   * `chip` (default) wraps the avatar in the frosted 44px pill; `plain`
   * renders the node as-is (e.g. khatma cover art) with only the float.
   */
  avatarVariant?: 'chip' | 'plain';
  /** Action slot at the inline-end (bell button, count pill). */
  action?: ReactNode;
  /** Extra hero row(s) below the title: search field, jump pills. */
  children?: ReactNode;
  /** Tighter padding for reader chrome. */
  compact?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * The redesign's emerald gradient hero: rounded bottom, gold radial glow, and
 * a slow shimmer sweep (design §3.1). Pure chrome — everything it shows comes
 * in through props, so member/admin apps supply identity and actions from
 * their own layers. Bleeds edge-to-edge over the shell's content padding on
 * mobile and becomes a fully-rounded banner on the desktop-rail layout.
 */
export function HeroHeader({
  eyebrow,
  title,
  titleComponent = 'div',
  avatar,
  avatarVariant = 'chip',
  action,
  children,
  compact = false,
  sx,
}: HeroHeaderProps) {
  return (
    <Box
      sx={mergeSx(
        (theme) => ({
          ...heroBleedSx,
          position: 'relative',
          overflow: 'hidden',
          background: theme.custom.heroGrad,
          color: theme.custom.heroInk,
          px: 5,
          pt: compact ? 3 : 4,
          pb: compact ? 4 : 6,
          borderRadius: {
            xs: `0 0 ${theme.custom.radii.hero}px ${theme.custom.radii.hero}px`,
            lg: `${theme.custom.radii.card}px`,
          },
        }),
        sx,
      )}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          background: theme.custom.heroGlow,
          pointerEvents: 'none',
        })}
      />
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          position: 'absolute',
          top: 0,
          insetInlineEnd: '-15%',
          width: 52,
          height: '200%',
          background: `linear-gradient(180deg, transparent, ${theme.custom.heroShimmer}, transparent)`,
          animation: `shimmer ${theme.custom.motion.shimmer} ${theme.custom.motion.easingSoft} infinite`,
          pointerEvents: 'none',
        })}
      />
      <Stack
        direction="row"
        sx={{
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 3, minWidth: 0 }}>
          {avatar ? (
            <Box
              aria-hidden="true"
              sx={(theme) => ({
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `floaty ${theme.custom.motion.floaty} ${theme.custom.motion.easingSoft} infinite`,
                ...(avatarVariant === 'chip'
                  ? {
                      width: 44,
                      height: 44,
                      borderRadius: `${theme.custom.radii.button}px`,
                      bgcolor: theme.custom.heroPill,
                      border: `1px solid ${theme.custom.heroPillBorder}`,
                      fontWeight: 700,
                      fontSize: '1rem',
                    }
                  : null),
              })}
            >
              {avatar}
            </Box>
          ) : null}
          <Box sx={{ minWidth: 0 }}>
            {eyebrow ? (
              <Typography component="div" sx={{ fontSize: '0.75rem', opacity: 0.85 }}>
                {eyebrow}
              </Typography>
            ) : null}
            <Typography
              component={titleComponent}
              variant="h2"
              sx={{ color: 'inherit', overflowWrap: 'anywhere' }}
            >
              {title}
            </Typography>
          </Box>
        </Stack>
        {action ? <Box sx={{ flex: 'none' }}>{action}</Box> : null}
      </Stack>
      {children ? <Box sx={{ position: 'relative', mt: 4 }}>{children}</Box> : null}
    </Box>
  );
}
