import { Stack, Typography } from '@mui/material';
import { AppButton } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { useMemberIdentity } from './memberIdentityContext';
import { useWriteOperation } from '@/app/operations';

/** Identity summary shown on the personal route. */
export function MemberIdentitySummary() {
  const { member, switchMember } = useMemberIdentity();
  const updatePerson = useWriteOperation('updatePerson');

  return (
    <Stack component="section" spacing={1}>
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.personal.heading}
      </Typography>
      <Typography color="text.secondary">{strings.member.greeting}</Typography>
      <Typography component="p" variant="h3">
        {member?.emoji ?? ''} {member?.name ?? ''}
      </Typography>
      <AppButton quiet variant="text" onClick={switchMember} sx={{ alignSelf: 'start' }}>
        {strings.member.switchPerson}
      </AppButton>
      <AppButton
        variant="outlined"
        onClick={() => {
          if (!member?.id) return;
          void updatePerson.execute(member.id, { enabled: !member.enabled });
        }}
      >
        {member?.enabled ? strings.admin.disable : strings.admin.enable}
      </AppButton>
    </Stack>
  );
}
