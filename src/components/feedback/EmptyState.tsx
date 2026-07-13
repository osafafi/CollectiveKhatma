import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { strings } from '@/content/strings.ar';

export interface EmptyStateProps {
  /** Primary line describing why nothing is shown. */
  message?: string;
  /** Optional secondary line under the message. */
  description?: string;
  /** Optional leading visual (icon/illustration). */
  icon?: ReactNode;
  /** Optional call to action (e.g. an "add" button). */
  action?: ReactNode;
  /** Minimum vertical space so the placeholder centers within its container. */
  minHeight?: number | string;
}

/**
 * Neutral empty-collection placeholder (RM-300).
 *
 * Deliberately distinct from {@link ErrorState}: an empty result is a normal,
 * non-error outcome, so this is quiet (muted text, no alert role) and offers an
 * optional forward action rather than a retry.
 */
export function EmptyState({
  message = strings.feedback.empty,
  description,
  icon,
  action,
  minHeight = 160,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 2,
        minHeight,
        py: 6,
        color: 'text.secondary',
      }}
    >
      {icon ? (
        <Box aria-hidden sx={{ fontSize: 48, lineHeight: 1 }}>
          {icon}
        </Box>
      ) : null}
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
    </Box>
  );
}
