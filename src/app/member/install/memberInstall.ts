import { useEffect, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export interface MemberInstallSnapshot {
  canPrompt: boolean;
  isInstalled: boolean;
}

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
let snapshot: MemberInstallSnapshot = {
  canPrompt: false,
  isInstalled: false,
};
const subscribers = new Set<() => void>();

function detectInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return (
    navigatorWithStandalone.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

function updateSnapshot(next: MemberInstallSnapshot): void {
  if (
    snapshot.canPrompt === next.canPrompt &&
    snapshot.isInstalled === next.isInstalled
  ) {
    return;
  }

  snapshot = next;
  subscribers.forEach((subscriber) => subscriber());
}

/** Capture Chromium's one-shot prompt early, before the lazy Settings route opens. */
export function initializeMemberInstall(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  updateSnapshot({ canPrompt: false, isInstalled: detectInstalled() });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    updateSnapshot({ canPrompt: true, isInstalled: false });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateSnapshot({ canPrompt: false, isInstalled: true });
  });
}

export async function requestMemberInstall(): Promise<InstallOutcome> {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';

  deferredPrompt = null;
  updateSnapshot({ canPrompt: false, isInstalled: false });

  try {
    const result = await prompt.prompt();
    if (result.outcome === 'accepted') {
      updateSnapshot({ canPrompt: false, isInstalled: true });
    }
    return result.outcome;
  } catch {
    return 'unavailable';
  }
}

function subscribe(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function useMemberInstall(): MemberInstallSnapshot {
  useEffect(initializeMemberInstall, []);
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
