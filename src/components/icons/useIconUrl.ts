import { useSyncExternalStore } from 'react';
import { getIconUrl, subscribeToIconUrls, type IconName } from './iconSource';

/** The current (override-aware) URL for an icon; re-renders on a PNG upgrade. */
export function useIconUrl(name: IconName): string {
  return useSyncExternalStore(subscribeToIconUrls, () => getIconUrl(name));
}
