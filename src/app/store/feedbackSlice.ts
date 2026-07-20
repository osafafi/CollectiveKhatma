import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MemberFeedback } from '@/domain/types';
import { createInitialListenerState, type ListenerState } from './listenerState';

export interface FeedbackState {
  items: MemberFeedback[];
  listener: ListenerState;
}

const initialState: FeedbackState = {
  items: [],
  listener: createInitialListenerState(),
};

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {
    feedbackSubscriptionStarted(state) {
      state.listener.status = 'loading';
      state.listener.error = null;
    },
    feedbackSnapshotReceived(state, action: PayloadAction<MemberFeedback[]>) {
      state.items = action.payload;
      state.listener.status = 'ready';
      state.listener.error = null;
    },
    feedbackSubscriptionFailed(state, action: PayloadAction<string>) {
      state.listener.status = 'error';
      state.listener.error = action.payload;
    },
    feedbackSubscriptionStopped(state) {
      state.items = [];
      state.listener.status = 'idle';
      state.listener.error = null;
    },
  },
});

export const feedbackActions = feedbackSlice.actions;
export const feedbackReducer = feedbackSlice.reducer;
