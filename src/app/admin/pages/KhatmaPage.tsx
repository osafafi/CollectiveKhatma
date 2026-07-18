import { Link, Stack, Typography } from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectKhatmaById,
  selectKhatmas,
  selectRoster,
  useAppSelector,
} from '@/app/store';
import { adminHash } from '@/app/routing/routes';
import { useSurahs } from '@/app/admin/useSurahs';
import {
  ActiveKhatmaControls,
  CompletedKhatmaControls,
} from '@/app/admin/khatma/KhatmaControls';
import { KhatmaHeaderCard } from '@/app/admin/khatma/KhatmaHeaderCard';
import { KhatmaHistoryCard } from '@/app/admin/khatma/KhatmaHistoryCard';
import { KhatmaMembersCard } from '@/app/admin/khatma/KhatmaMembersCard';
import { KhatmaMetadataEditor } from '@/app/admin/khatma/KhatmaMetadataEditor';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';

/** Route container for one admin khatma detail page. */
export function AdminKhatmaPage({ id }: { id: string }) {
  const khatmas = useAppSelector(selectKhatmas);
  const khatma = useAppSelector((state) => selectKhatmaById(state, id));
  const assignments = useAppSelector((state) => selectAssignmentsForKhatma(state, id));
  const roster = useAppSelector(selectRoster);
  const surahs = useSurahs();

  if (!khatma) {
    return (
      <Stack
        component="section"
        spacing={4}
        data-react-surface="admin"
        data-route="khatma"
      >
        <BackLink />
        <SurfaceCard>
          <Typography color="text.secondary">
            {khatmas.length === 0 ? strings.common.loading : strings.admin.noActive}
          </Typography>
        </SurfaceCard>
      </Stack>
    );
  }

  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="khatma">
      <BackLink />
      <KhatmaHeaderCard khatma={khatma} assignments={assignments} roster={roster} />
      <KhatmaMetadataEditor khatma={khatma} />
      {khatma.status === 'active' ? (
        <>
          <KhatmaMembersCard
            khatma={khatma}
            khatmas={khatmas}
            assignments={assignments}
            roster={roster}
            surahs={surahs}
          />
          <ActiveKhatmaControls khatma={khatma} roster={roster} />
        </>
      ) : (
        <CompletedKhatmaControls khatma={khatma} />
      )}
      <KhatmaHistoryCard khatma={khatma} khatmas={khatmas} roster={roster} />
    </Stack>
  );
}

function BackLink() {
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
