import { Box, CircularProgress, Typography } from '@mui/material';
import { strings } from '@/content/strings.ar';

export interface LoadingStateProps {
  /** Status text under the spinner. Defaults to the shared loading copy. */
  message?: string;
  /** Minimum vertical space so the spinner centers within a route/section. */
  minHeight?: number | string;
}

/**
 * Centered loading indicator with an accessible status message.
 *
 * The wrapper is a `role="status"` + `aria-live="polite"` region so assistive
 * tech announces the wait once, without stealing focus; the spinner itself is
 * `aria-hidden` because the text carries the meaning. Feature routes
 * render this while a Firestore listener status is `idle`/`loading`.
 */
export function LoadingState({
  message = strings.feedback.loading,
  minHeight = 160,
}: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minHeight,
        py: 6,
      }}
    >
      <CircularProgress aria-hidden />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
