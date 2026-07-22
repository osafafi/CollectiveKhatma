import { Stack, Typography } from '@mui/material';
import { AppButton } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { useMemberIdentity } from './memberIdentityContext';
import { useWriteOperation } from '@/app/operations';

/** Identity summary shown on the personal route (name lives in the hero). */
export function MemberIdentitySummary() {
  const { member, switchMember } = useMemberIdentity();
  const updatePerson = useWriteOperation('updatePerson');

  return (
    <Stack component="section" spacing={2}>
      <Typography component="h1" variant="h3" color="text.primary">
        {strings.personal.heading}
      </Typography>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <AppButton
          quiet
          variant="text"
          onClick={switchMember}
          sx={{ alignSelf: 'start' }}
        >
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
    </Stack>
  );
}
