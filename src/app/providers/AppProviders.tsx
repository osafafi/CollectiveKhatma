import type { ReactNode } from 'react';
import {
  WriteOperationsProvider,
  writeOperations,
  type WriteOperations,
} from '@/app/operations';
import { AppStoreProvider } from '@/app/providers/AppStoreProvider';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { ConfirmationProvider } from '@/app/providers/ConfirmationProvider';
import { ErrorBoundary } from '@/app/providers/ErrorBoundary';
import { SnackbarProvider } from '@/app/providers/SnackbarProvider';
import { AppHashRouter } from '@/app/routing/AppHashRouter';
import type { AppStore, FirestoreSubscriptionSources } from '@/app/store';

interface AppProvidersProps {
  children: ReactNode;
  /** Test/preview override for the Redux store (defaults to the shared store). */
  appStore?: AppStore;
  /** Test/preview override for the Firestore subscription sources. */
  sources?: FirestoreSubscriptionSources;
  /** Test/preview override for the data-layer mutations (defaults to the real set). */
  operations?: WriteOperations;
}

/**
 * The single shared provider stack for both React entries.
 *
 * Composition order (outer → inner) and why each layer sits where it does:
 *   AppStoreProvider   Redux store + the three global Firestore subscriptions.
 *   AppThemeProvider   MUI RTL theme + CssBaseline; must wrap everything visual.
 *   ErrorBoundary      Catches render crashes and shows a themed, RTL fallback —
 *                      inside the theme (so the fallback is styled) but outside
 *                      the feature subtree it guards.
 *   WriteOperations    Injectable data-layer mutations (defaults to the real set).
 *   SnackbarProvider   App-wide transient feedback available to every route.
 *   Confirmation       Queued async replacement for native `window.confirm`.
 *   AppHashRouter      Hash routing wrapping the feature subtree.
 *
 * MemberApp and AdminApp both render through this so the provider wiring lives in
 * exactly one place; the optional props keep it injectable for tests/previews
 * without re-threading the composition.
 */
export function AppProviders({
  children,
  appStore,
  sources,
  operations = writeOperations,
}: AppProvidersProps) {
  return (
    <AppStoreProvider appStore={appStore} sources={sources}>
      <AppThemeProvider>
        <ErrorBoundary>
          <WriteOperationsProvider operations={operations}>
            <SnackbarProvider>
              <ConfirmationProvider>
                <AppHashRouter>{children}</AppHashRouter>
              </ConfirmationProvider>
            </SnackbarProvider>
          </WriteOperationsProvider>
        </ErrorBoundary>
      </AppThemeProvider>
    </AppStoreProvider>
  );
}
