import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Assignment } from '@/domain/types';
import { createInitialListenerState, type ListenerState } from './listenerState';

export const assignmentsAdapter = createEntityAdapter<Assignment, string>({
  selectId: (assignment) => assignment.memberId,
});

export type AssignmentBucket = ReturnType<
  typeof assignmentsAdapter.getInitialState<{ listener: ListenerState }>
>;

export interface AssignmentsState {
  /** One independently subscribed entity collection per khatma. */
  byKhatmaId: Record<string, AssignmentBucket>;
}

const initialState: AssignmentsState = { byKhatmaId: {} };

function createAssignmentBucket(): AssignmentBucket {
  return assignmentsAdapter.getInitialState({
    listener: createInitialListenerState(),
  });
}

interface AssignmentSubscriptionPayload {
  khatmaId: string;
}

interface AssignmentSnapshotPayload extends AssignmentSubscriptionPayload {
  assignments: Assignment[];
}

interface AssignmentFailurePayload extends AssignmentSubscriptionPayload {
  error: string;
}

const assignmentsSlice = createSlice({
  name: 'assignments',
  initialState,
  reducers: {
    assignmentsSubscriptionStarted(
      state,
      action: PayloadAction<AssignmentSubscriptionPayload>,
    ) {
      const { khatmaId } = action.payload;
      const bucket = state.byKhatmaId[khatmaId] ?? createAssignmentBucket();
      bucket.listener.status = 'loading';
      bucket.listener.error = null;
      state.byKhatmaId[khatmaId] = bucket;
    },
    assignmentsSnapshotReceived(state, action: PayloadAction<AssignmentSnapshotPayload>) {
      const { khatmaId, assignments } = action.payload;
      const bucket = state.byKhatmaId[khatmaId] ?? createAssignmentBucket();
      const nextBucket = assignmentsAdapter.setAll(bucket, assignments);
      nextBucket.listener.status = 'ready';
      nextBucket.listener.error = null;
      state.byKhatmaId[khatmaId] = nextBucket;
    },
    assignmentsSubscriptionFailed(
      state,
      action: PayloadAction<AssignmentFailurePayload>,
    ) {
      const { khatmaId, error } = action.payload;
      const bucket = state.byKhatmaId[khatmaId] ?? createAssignmentBucket();
      bucket.listener.status = 'error';
      bucket.listener.error = error;
      state.byKhatmaId[khatmaId] = bucket;
    },
    assignmentsSubscriptionStopped(
      state,
      action: PayloadAction<AssignmentSubscriptionPayload>,
    ) {
      const bucket = state.byKhatmaId[action.payload.khatmaId];
      if (!bucket) return;
      bucket.listener.status = 'idle';
      bucket.listener.error = null;
    },
    assignmentsRemoved(state, action: PayloadAction<AssignmentSubscriptionPayload>) {
      delete state.byKhatmaId[action.payload.khatmaId];
    },
  },
});

export const assignmentsActions = assignmentsSlice.actions;
export const assignmentsReducer = assignmentsSlice.reducer;
