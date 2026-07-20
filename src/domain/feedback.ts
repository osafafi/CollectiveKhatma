export const FEEDBACK_MIN_CHARACTERS = 10;
export const FEEDBACK_MAX_CHARACTERS = 500;

/** Remove surrounding whitespace before feedback is validated or persisted. */
export function normalizeFeedbackMessage(message: string): string {
  return message.trim();
}

/** The member form and data boundary share the same 10–500 character rule. */
export function isValidFeedbackMessage(message: string): boolean {
  const length = normalizeFeedbackMessage(message).length;
  return length >= FEEDBACK_MIN_CHARACTERS && length <= FEEDBACK_MAX_CHARACTERS;
}
