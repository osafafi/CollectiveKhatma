import { configureStore } from '@reduxjs/toolkit';
import { assignmentsReducer } from './assignmentsSlice';
import { contentReducer } from './contentSlice';
import { khatmasReducer } from './khatmasSlice';
import { rosterReducer } from './rosterSlice';

export function createAppStore() {
  return configureStore({
    reducer: {
      roster: rosterReducer,
      khatmas: khatmasReducer,
      assignments: assignmentsReducer,
      content: contentReducer,
    },
  });
}

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
