import type { RootState } from './store';

export const selectFeedback = (state: RootState) => state.feedback.items;
export const selectFeedbackListener = (state: RootState) => state.feedback.listener;
export const selectUnreadFeedbackCount = (state: RootState) =>
  state.feedback.items.reduce((count, feedback) => count + (feedback.isRead ? 0 : 1), 0);
