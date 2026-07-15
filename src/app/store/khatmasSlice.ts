import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Khatma } from '@/domain/types';
import { createInitialListenerState } from './listenerState';

export const khatmasAdapter = createEntityAdapter<Khatma>();

const initialState = khatmasAdapter.getInitialState({
  listener: createInitialListenerState(),
});

export type KhatmasState = typeof initialState;

const khatmasSlice = createSlice({
  name: 'khatmas',
  initialState,
  reducers: {
    khatmasSubscriptionStarted(state) {
      state.listener.status = 'loading';
      state.listener.error = null;
    },
    khatmasSnapshotReceived(state, action: PayloadAction<Khatma[]>) {
      khatmasAdapter.setAll(state, action.payload);
      state.listener.status = 'ready';
      state.listener.error = null;
    },
    khatmasSubscriptionFailed(state, action: PayloadAction<string>) {
      state.listener.status = 'error';
      state.listener.error = action.payload;
    },
    khatmasSubscriptionStopped(state) {
      state.listener.status = 'idle';
      state.listener.error = null;
    },
  },
});

export const khatmasActions = khatmasSlice.actions;
export const khatmasReducer = khatmasSlice.reducer;
