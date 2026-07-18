import type { ReactNode } from 'react';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

export type AsyncContentStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AsyncContentProps {
  /** Structural async status accepted from any listener or request state. */
  status: AsyncContentStatus;
  /** Human-readable listener error, if any (string-only, as stored in Redux). */
  error?: string | null;
  /** True when the listener is ready but the collection is empty. */
  isEmpty?: boolean;
  /** Retry handler forwarded to {@link ErrorState}. */
  onRetry?: () => void;
  /** Copy/overrides for the empty placeholder. */
  empty?: EmptyStateProps;
  /** Optional override for the loading message. */
  loadingMessage?: string;
  /** Optional overrides for the error heading/body. */
  errorTitle?: string;
  errorMessage?: string;
  /** Rendered only when data is ready and non-empty. */
  children: ReactNode;
}

/**
 * One switch from a structural async status to the shared
 * loading / empty / error / retry feedback. Feature routes
 * wrap their content in this instead of re-implementing the four states, so the
 * primitives stay the single source of the states' look and semantics.
 *
 * `idle` is treated as loading: the subscription bridge starts a listener the
 * moment it is subscribed, so `idle` is a pre-subscription flash rather than a
 * resting state a user should ever be parked on.
 */
export function AsyncContent({
  status,
  error,
  isEmpty = false,
  onRetry,
  empty,
  loadingMessage,
  errorTitle,
  errorMessage,
  children,
}: AsyncContentProps) {
  if (status === 'error') {
    return (
      <ErrorState
        title={errorTitle}
        message={errorMessage ?? error ?? undefined}
        onRetry={onRetry}
      />
    );
  }

  if (status === 'idle' || status === 'loading') {
    return <LoadingState message={loadingMessage} />;
  }

  if (isEmpty) {
    return <EmptyState {...empty} />;
  }

  return <>{children}</>;
}
