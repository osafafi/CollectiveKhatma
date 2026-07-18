import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { strings } from '@/content/strings.ar';

export interface ErrorStateProps {
  /** Short error heading. */
  title?: string;
  /** Human-readable error detail — never a raw Error/Firestore object. */
  message?: string;
  /** When provided, renders a retry affordance wired to this handler. */
  onRetry?: () => void;
  /** Overrides the retry button label. */
  retryLabel?: string;
}

/**
 * Inline error panel with an optional retry.
 *
 * Built on an MUI `Alert` (`role="alert"`) so assistive tech announces failures
 * immediately. The retry button renders only when `onRetry` is supplied, so the
 * same component serves both recoverable listener/query errors and terminal
 * ones. Callers pass an already-humanized `message` (e.g. the string-only error
 * a Redux listener stored), keeping raw SDK objects out of the view.
 */
export function ErrorState({
  title = strings.feedback.errorTitle,
  message = strings.feedback.errorBody,
  onRetry,
  retryLabel = strings.feedback.retry,
}: ErrorStateProps) {
  return (
    <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
      <Alert
        severity="error"
        variant="outlined"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : undefined
        }
        sx={{ width: '100%', maxWidth: 520 }}
      >
        <AlertTitle>{title}</AlertTitle>
        {message}
      </Alert>
    </Box>
  );
}
