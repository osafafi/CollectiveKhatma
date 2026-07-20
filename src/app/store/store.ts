import { configureStore } from '@reduxjs/toolkit';
import { assignmentsReducer } from './assignmentsSlice';
import { contentReducer } from './contentSlice';
import { feedbackReducer } from './feedbackSlice';
import { khatmasReducer } from './khatmasSlice';
import { rosterReducer } from './rosterSlice';

export function createAppStore() {
  return configureStore({
    reducer: {
      roster: rosterReducer,
      khatmas: khatmasReducer,
      assignments: assignmentsReducer,
      content: contentReducer,
      feedback: feedbackReducer,
    },
  });
}

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
