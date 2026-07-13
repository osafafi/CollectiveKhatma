/** Serializable lifecycle state shared by every Firestore-backed slice. */
export type ListenerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ListenerState {
  status: ListenerStatus;
  /** Human-readable message only; Error and Firestore objects stay outside Redux. */
  error: string | null;
}

export function createInitialListenerState(): ListenerState {
  return { status: 'idle', error: null };
}
