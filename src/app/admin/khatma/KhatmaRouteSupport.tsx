import { Link, Stack, Typography } from '@mui/material';
import { adminHash } from '@/app/routing/routes';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';

export function KhatmaBackLink() {
  return (
    <Link
      href={adminHash.khatmas()}
      underline="always"
      variant="body2"
      color="text.secondary"
      sx={{ alignSelf: 'start' }}
    >
      {`‹ ${strings.admin.navKhatmas}`}
    </Link>
  );
}

export function MissingKhatmaState({ hasSeries }: { hasSeries: boolean }) {
  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="khatma">
      <KhatmaBackLink />
      <SurfaceCard>
        <Typography color="text.secondary">
          {hasSeries ? strings.admin.noActive : strings.common.loading}
        </Typography>
      </SurfaceCard>
    </Stack>
  );
}
