import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GlobalContent } from '@/domain/types';
import { createInitialListenerState, type ListenerState } from './listenerState';

export interface ContentState {
  value: GlobalContent | null;
  listener: ListenerState;
}

const initialState: ContentState = {
  value: null,
  listener: createInitialListenerState(),
};

const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    contentSubscriptionStarted(state) {
      state.listener.status = 'loading';
      state.listener.error = null;
    },
    contentSnapshotReceived(state, action: PayloadAction<GlobalContent | null>) {
      state.value = action.payload;
      state.listener.status = 'ready';
      state.listener.error = null;
    },
    contentSubscriptionFailed(state, action: PayloadAction<string>) {
      state.listener.status = 'error';
      state.listener.error = action.payload;
    },
    contentSubscriptionStopped(state) {
      state.listener.status = 'idle';
      state.listener.error = null;
    },
  },
});

export const contentActions = contentSlice.actions;
export const contentReducer = contentSlice.reducer;
