import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/feedback';
import { strings } from '@/content/strings.ar';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback; receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Notified after a caught error (e.g. for logging/telemetry). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-level React error boundary (RM-300).
 *
 * Catches render/lifecycle errors in its subtree, shows a themed, RTL-correct
 * fallback with a retry, and re-mounts the subtree when the user retries. It
 * complements — does not replace — the local per-operation failure feedback
 * (`useOperation`): this is the last resort for unexpected render crashes, while
 * expected async failures stay inline next to the action that caused them.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the crash for local debugging; nothing here reaches Redux, so no
    // Error/SDK object is persisted — only the console gets the detail.
    console.error('Unhandled React error:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return (
        <ErrorState
          title={strings.feedback.crashTitle}
          message={strings.feedback.crashBody}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
