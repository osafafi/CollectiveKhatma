import { Stack, Typography } from '@mui/material';
import { AppButton } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { useMemberIdentity } from './memberIdentityContext';

/** Identity-only portion of the personal route; RM-420 adds its insight content. */
export function MemberIdentitySummary() {
  const { member, switchMember } = useMemberIdentity();

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
    </Stack>
  );
}
