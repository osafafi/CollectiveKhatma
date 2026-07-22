import type { ReactNode } from 'react';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, Paper } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { appearSx } from './appearSx';
import { mergeSx } from './mergeSx';

export interface CollapsibleCardProps {
  title: ReactNode;
  /** Disclosure state is lifted so it survives route-change re-renders. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** List position for the staggered fadeUp entry; omit for no motion. */
  appear?: number;
  sx?: SxProps<Theme>;
}

/**
 * Card-styled native `<details>/<summary>` disclosure — the redesign's
 * collapsible recipe (rotating chevron, card gradient/shadow). Native
 * disclosure semantics are a hard rule for group-progress, history, and
 * settings sections; only the chevron animates.
 */
export function CollapsibleCard({
  title,
  open,
  onOpenChange,
  children,
  appear,
  sx,
}: CollapsibleCardProps) {
  return (
    <Paper
      component="details"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      variant="outlined"
      sx={mergeSx(
        mergeSx(
          (theme) => ({
            overflow: 'hidden',
            borderRadius: `${theme.custom.radii.card}px`,
            backgroundImage: theme.custom.cardBg.startsWith('linear-gradient')
              ? theme.custom.cardBg
              : 'none',
            boxShadow: theme.custom.cardShadow,
            '&[open] .collapsible-chev': { transform: 'rotate(180deg)' },
          }),
          appearSx(appear),
        ),
        sx,
      )}
    >
      <Box
        component="summary"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          cursor: 'pointer',
          px: 4,
          py: 3,
          userSelect: 'none',
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
        }}
      >
        <Box
          component="span"
          sx={{ fontSize: '1.125rem', fontWeight: 700, color: 'text.primary' }}
        >
          {title}
        </Box>
        <Box
          component="span"
          className="collapsible-chev"
          aria-hidden="true"
          sx={(theme) => ({
            display: 'flex',
            color: 'text.secondary',
            transition: `transform ${theme.custom.motion.fast} ${theme.custom.motion.easing}`,
          })}
        >
          <ExpandMoreRoundedIcon />
        </Box>
      </Box>
      <Box sx={{ px: 4, pb: 4 }}>{children}</Box>
    </Paper>
  );
}
