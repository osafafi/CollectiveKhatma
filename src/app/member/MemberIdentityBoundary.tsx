import { useCallback, useMemo, type ReactNode } from 'react';
import { useRememberedMemberId } from '@/app/persistence';
import { selectPersonById, useAppSelector } from '@/app/store';
import { MemberIdentityContext, type MemberIdentity } from './memberIdentityContext';
import { MemberIdentityGate } from './MemberIdentityGate';

/** Own the browser-local member identity and keep the gate outside app chrome. */
export function MemberIdentityBoundary({ children }: { children: ReactNode }) {
  const [memberId, setMemberId] = useRememberedMemberId();
  const member = useAppSelector((state) =>
    memberId === null ? undefined : selectPersonById(state, memberId),
  );
  const switchMember = useCallback(() => setMemberId(null), [setMemberId]);
  const identity = useMemo<MemberIdentity | null>(
    () => (memberId === null ? null : { memberId, member, switchMember }),
    [member, memberId, switchMember],
  );

  if (identity === null) {
    return <MemberIdentityGate onSelectMember={setMemberId} />;
  }

  return (
    <MemberIdentityContext.Provider value={identity}>
      {children}
    </MemberIdentityContext.Provider>
  );
}
