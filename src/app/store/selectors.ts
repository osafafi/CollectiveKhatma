import { createSelector } from '@reduxjs/toolkit';
import { assignmentsAdapter } from './assignmentsSlice';
import { khatmasAdapter } from './khatmasSlice';
import { rosterAdapter } from './rosterSlice';
import type { RootState } from './store';

export const selectRosterState = (state: RootState) => state.roster;
export const selectRosterListener = (state: RootState) => state.roster.listener;

const rosterSelectors = rosterAdapter.getSelectors(selectRosterState);
export const selectRoster = rosterSelectors.selectAll;
export const selectPersonById = rosterSelectors.selectById;

export const selectKhatmasState = (state: RootState) => state.khatmas;
export const selectKhatmasListener = (state: RootState) => state.khatmas.listener;

const khatmasSelectors = khatmasAdapter.getSelectors(selectKhatmasState);
export const selectKhatmas = khatmasSelectors.selectAll;
export const selectKhatmaById = khatmasSelectors.selectById;

export const selectContentState = (state: RootState) => state.content;
export const selectContent = (state: RootState) => state.content.value;
export const selectContentListener = (state: RootState) => state.content.listener;

export const selectAssignmentsState = (state: RootState) => state.assignments;

const selectAssignmentBucket = (state: RootState, khatmaId: string) =>
  state.assignments.byKhatmaId[khatmaId];
const assignmentsSelectors = assignmentsAdapter.getSelectors();
const EMPTY_ASSIGNMENTS = [] as const;

export const selectAssignmentsForKhatma = createSelector(
  [selectAssignmentBucket],
  (bucket) => (bucket ? assignmentsSelectors.selectAll(bucket) : EMPTY_ASSIGNMENTS),
);

export const selectAssignmentByMemberId = createSelector(
  [
    selectAssignmentBucket,
    (_state: RootState, _khatmaId: string, memberId: string) => memberId,
  ],
  (bucket, memberId) =>
    bucket ? assignmentsSelectors.selectById(bucket, memberId) : undefined,
);

export const selectAssignmentsListener = createSelector(
  [selectAssignmentBucket],
  (bucket) => bucket?.listener,
);
