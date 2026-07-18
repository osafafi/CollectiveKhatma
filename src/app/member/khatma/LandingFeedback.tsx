import { Stack, Typography } from '@mui/material';
import { memberHash } from '@/app/routing/routes';
import { ErrorState } from '@/components/feedback';
import { AppButton, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';

type LandingFeedbackKind = 'loading' | 'not-found' | 'error';

export function LandingFeedback({ kind }: { kind: LandingFeedbackKind }) {
  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="member"
      data-route="khatma"
    >
      {kind === 'loading' ? null : (
        <AppButton
          quiet
          variant="text"
          href={memberHash.khatmas()}
          sx={{ alignSelf: 'start' }}
        >
          {strings.member.khatmasHeading}
        </AppButton>
      )}
      {kind === 'error' ? (
        <ErrorState message={strings.member.connectionError} />
      ) : (
        <SurfaceCard>
          <Typography color="text.secondary">
            {kind === 'loading' ? strings.common.loading : strings.member.noKhatmas}
          </Typography>
        </SurfaceCard>
      )}
    </Stack>
  );
}
