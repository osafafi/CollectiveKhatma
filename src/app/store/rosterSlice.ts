import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Person } from '@/domain/types';
import { createInitialListenerState } from './listenerState';

export const rosterAdapter = createEntityAdapter<Person>();

const initialState = rosterAdapter.getInitialState({
  listener: createInitialListenerState(),
});

export type RosterState = typeof initialState;

const rosterSlice = createSlice({
  name: 'roster',
  initialState,
  reducers: {
    rosterSubscriptionStarted(state) {
      state.listener.status = 'loading';
      state.listener.error = null;
    },
    rosterSnapshotReceived(state, action: PayloadAction<Person[]>) {
      rosterAdapter.setAll(state, action.payload);
      state.listener.status = 'ready';
      state.listener.error = null;
    },
    rosterSubscriptionFailed(state, action: PayloadAction<string>) {
      state.listener.status = 'error';
      state.listener.error = action.payload;
    },
    rosterSubscriptionStopped(state) {
      state.listener.status = 'idle';
      state.listener.error = null;
    },
  },
});

export const rosterActions = rosterSlice.actions;
export const rosterReducer = rosterSlice.reducer;
