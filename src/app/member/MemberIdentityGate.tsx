import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { AppButton, NoticeBanner, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { selectRoster, selectRosterListener, useAppSelector } from '@/app/store';
import { useOnlineStatus } from './useOnlineStatus';

interface MemberIdentityGateProps {
  onSelectMember: (memberId: string) => void;
}

/** Member entry gate backed by the provider-owned live roster subscription. */
export function MemberIdentityGate({ onSelectMember }: MemberIdentityGateProps) {
  const roster = useAppSelector(selectRoster);
  const listener = useAppSelector(selectRosterListener);
  const online = useOnlineStatus();

  return (
    <Box component="main" sx={{ mx: 'auto', width: '100%', maxWidth: 576, p: 4 }}>
      <Stack spacing={6}>
        <Box component="header" sx={{ textAlign: 'center' }}>
          <Typography component="h1" variant="h1" color="primary.main">
            {strings.member.title}
          </Typography>
          <Typography color="text.secondary">{strings.member.tagline}</Typography>
        </Box>

        <SurfaceCard title={strings.member.choosePrompt}>
          <RosterGateState
            roster={roster}
            status={listener.status}
            online={online}
            onSelectMember={onSelectMember}
          />
        </SurfaceCard>
      </Stack>
    </Box>
  );
}

interface RosterGateStateProps {
  roster: ReturnType<typeof selectRoster>;
  status: ReturnType<typeof selectRosterListener>['status'];
  online: boolean;
  onSelectMember: (memberId: string) => void;
}

function RosterGateState({
  roster,
  status,
  online,
  onSelectMember,
}: RosterGateStateProps) {
  // The gate sits outside the shell, so it carries its own offline word. No
  // roster while offline means nothing is cached on this device — the one case
  // Firestore's persistence cannot rescue. It is keyed on the empty roster
  // rather than on listener status because an empty cache arrives as a *ready*
  // empty snapshot, which would otherwise read to a member as "this group has
  // no members yet" — a guess dressed as an answer.
  if (!online && roster.length === 0) {
    return (
      <NoticeBanner tone="warning" role="status">
        {strings.member.offlineNoData}
      </NoticeBanner>
    );
  }

  if (status === 'error') {
    return (
      <NoticeBanner tone="danger" role="alert">
        {strings.member.connectionError}
      </NoticeBanner>
    );
  }

  if (status !== 'ready') {
    return (
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }} role="status">
        <CircularProgress size={24} aria-hidden="true" />
        <Typography color="text.secondary">{strings.member.connecting}</Typography>
      </Stack>
    );
  }

  if (roster.length === 0) {
    return (
      <Typography color="text.secondary" role="status">
        {strings.member.emptyRoster}
      </Typography>
    );
  }

  return (
    <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {roster.map((person) => (
        <Box component="li" key={person.id}>
          <AppButton hero onClick={() => onSelectMember(person.id)}>
            {person.emoji || ''} {person.name}
          </AppButton>
        </Box>
      ))}
    </Stack>
  );
}
