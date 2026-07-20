import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import type { MemberFeedback } from '@/domain/types';
import { db } from './firebase';

const feedbackCol = collection(db, 'content', 'feedback', 'messages');

/** Live-subscribe to newest feedback first. Loaded only by the admin shell. */
export function subscribeFeedback(
  onChange: (feedback: MemberFeedback[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(feedbackCol, orderBy('createdAt', 'desc')),
    (snapshot) =>
      onChange(
        snapshot.docs.map((item) => ({
          ...(item.data() as Omit<MemberFeedback, 'id'>),
          id: item.id,
        })),
      ),
    (error) => onError?.(error),
  );
}
