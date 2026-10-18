import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WirdCompletion } from '@/domain/types';
import { createInitialListenerState, type ListenerState } from './listenerState';

export const wirdCompletionsAdapter = createEntityAdapter<WirdCompletion, string>({
  selectId: (completion) => completion.id,
  sortComparer: (left, right) => right.completedAt - left.completedAt,
});

export type WirdCompletionBucket = ReturnType<
  typeof wirdCompletionsAdapter.getInitialState<{ listener: ListenerState }>
>;

export interface WirdCompletionsState {
  byWirdId: Record<string, WirdCompletionBucket>;
}

const initialState: WirdCompletionsState = { byWirdId: {} };

function createBucket(): WirdCompletionBucket {
  return wirdCompletionsAdapter.getInitialState({
    listener: createInitialListenerState(),
  });
}

const wirdCompletionsSlice = createSlice({
  name: 'wirdCompletions',
  initialState,
  reducers: {
    subscriptionStarted(state, action: PayloadAction<{ wirdId: string }>) {
      const bucket = state.byWirdId[action.payload.wirdId] ?? createBucket();
      bucket.listener.status = 'loading';
      bucket.listener.error = null;
      state.byWirdId[action.payload.wirdId] = bucket;
    },
    snapshotReceived(
      state,
      action: PayloadAction<{ wirdId: string; completions: WirdCompletion[] }>,
    ) {
      const bucket = state.byWirdId[action.payload.wirdId] ?? createBucket();
      const next = wirdCompletionsAdapter.setAll(bucket, action.payload.completions);
      next.listener.status = 'ready';
      next.listener.error = null;
      state.byWirdId[action.payload.wirdId] = next;
    },
    subscriptionFailed(state, action: PayloadAction<{ wirdId: string; error: string }>) {
      const bucket = state.byWirdId[action.payload.wirdId] ?? createBucket();
      bucket.listener.status = 'error';
      bucket.listener.error = action.payload.error;
      state.byWirdId[action.payload.wirdId] = bucket;
    },
    subscriptionStopped(state, action: PayloadAction<{ wirdId: string }>) {
      const bucket = state.byWirdId[action.payload.wirdId];
      if (!bucket) return;
      bucket.listener.status = 'idle';
      bucket.listener.error = null;
    },
    removed(state, action: PayloadAction<{ wirdId: string }>) {
      delete state.byWirdId[action.payload.wirdId];
    },
  },
});

export const wirdCompletionsActions = wirdCompletionsSlice.actions;
export const wirdCompletionsReducer = wirdCompletionsSlice.reducer;
