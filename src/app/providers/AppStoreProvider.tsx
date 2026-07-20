import { useEffect, useMemo, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import {
  createFirestoreSubscriptionBridge,
  type FirestoreSubscriptionSources,
} from '@/app/store/firestoreSubscriptionBridge';
import { FirestoreSubscriptionContext } from '@/app/store/firestoreSubscriptionContext';
import { firestoreSubscriptionSources } from '@/app/store/firestoreSubscriptionSources';
import { store, type AppStore } from '@/app/store/store';

interface AppStoreProviderProps {
  children: ReactNode;
  appStore?: AppStore;
  sources?: FirestoreSubscriptionSources;
}

/** Redux provider and owner of shared plus feature-retained Firestore subscriptions. */
export function AppStoreProvider({
  children,
  appStore = store,
  sources = firestoreSubscriptionSources,
}: AppStoreProviderProps) {
  const activeBridge = useMemo(
    () => createFirestoreSubscriptionBridge(appStore, sources),
    [appStore, sources],
  );

  useEffect(() => activeBridge.startGlobalSubscriptions(), [activeBridge]);

  return (
    <Provider store={appStore}>
      <FirestoreSubscriptionContext.Provider value={activeBridge}>
        {children}
      </FirestoreSubscriptionContext.Provider>
    </Provider>
  );
}
