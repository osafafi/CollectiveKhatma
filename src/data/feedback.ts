import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { isValidFeedbackMessage, normalizeFeedbackMessage } from '@/domain/feedback';
import type { MemberFeedback } from '@/domain/types';
import { db } from './firebase';

/** Append-only feedback messages nested under the content namespace. */
const feedbackCol = collection(db, 'content', 'feedback', 'messages');

/** Create a fresh unread feedback document for every member submission. */
export async function submitFeedback(
  memberId: string,
  memberName: string,
  message: string,
): Promise<string> {
  const normalizedMessage = normalizeFeedbackMessage(message);
  const normalizedMemberName = memberName.trim();
  if (!isValidFeedbackMessage(normalizedMessage) || normalizedMemberName === '') {
    throw new Error('Feedback requires a member name and 10 to 500 characters.');
  }

  const created = await addDoc(feedbackCol, {
    memberId,
    memberName: normalizedMemberName,
    message: normalizedMessage,
    isRead: false,
    createdAt: Date.now(),
  } satisfies Omit<MemberFeedback, 'id'>);
  return created.id;
}

export function setFeedbackRead(feedbackId: string, isRead: boolean): Promise<void> {
  return updateDoc(doc(feedbackCol, feedbackId), { isRead });
}

export function deleteFeedback(feedbackId: string): Promise<void> {
  return deleteDoc(doc(feedbackCol, feedbackId));
}
