type FeedbackData = typeof import('./feedback');

/** Lazy write adapters keep feedback-only Firestore code out of initial bundles. */
export const submitFeedback: FeedbackData['submitFeedback'] = async (...args) => {
  const feedback = await import('./feedback');
  return feedback.submitFeedback(...args);
};

export const setFeedbackRead: FeedbackData['setFeedbackRead'] = async (...args) => {
  const feedback = await import('./feedback');
  return feedback.setFeedbackRead(...args);
};

export const deleteFeedback: FeedbackData['deleteFeedback'] = async (...args) => {
  const feedback = await import('./feedback');
  return feedback.deleteFeedback(...args);
};
