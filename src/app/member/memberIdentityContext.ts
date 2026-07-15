import { createContext, useContext } from 'react';
import type { Person } from '@/domain/types';

export interface MemberIdentity {
  memberId: string;
  /** The current live roster record, or undefined until/if it is available. */
  member: Person | undefined;
  /** Clear this browser's trust-based identity and return to the roster gate. */
  switchMember: () => void;
}

export const MemberIdentityContext = createContext<MemberIdentity | null>(null);

/** Read the selected member and switch action from inside the identity boundary. */
export function useMemberIdentity(): MemberIdentity {
  const identity = useContext(MemberIdentityContext);
  if (identity === null) {
    throw new Error('useMemberIdentity must be used inside MemberIdentityBoundary.');
  }
  return identity;
}
