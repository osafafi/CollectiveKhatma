import { Stack } from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectKhatmaById,
  selectKhatmas,
  selectRoster,
  selectWirdCompletions,
  selectWirdCompletionsListener,
  useAppSelector,
} from '@/app/store';
import { useQuranScopeMaps } from '@/app/admin/useQuranScopeMaps';
import { useSurahs } from '@/app/admin/useSurahs';
import {
  ActiveKhatmaControls,
  CompletedKhatmaControls,
} from '@/app/admin/khatma/KhatmaControls';
import { KhatmaHeaderCard } from '@/app/admin/khatma/KhatmaHeaderCard';
import { KhatmaHistoryCard } from '@/app/admin/khatma/KhatmaHistoryCard';
import { KhatmaMembersCard } from '@/app/admin/khatma/KhatmaMembersCard';
import { KhatmaMetadataEditor } from '@/app/admin/khatma/KhatmaMetadataEditor';
import { KhatmaReadingLogCard } from '@/app/admin/khatma/KhatmaReadingLogCard';
import {
  KhatmaBackLink,
  MissingKhatmaState,
} from '@/app/admin/khatma/KhatmaRouteSupport';
import { fullyUnreadSurahIds } from '@/domain/assignment';
import { isWird } from '@/domain/wird';
import { WirdAdminDetail } from '@/app/admin/wird/WirdAdminDetail';

/** Route container for one admin khatma detail page. */
export function AdminKhatmaPage({ id }: { id: string }) {
  const khatmas = useAppSelector(selectKhatmas);
  const khatma = useAppSelector((state) => selectKhatmaById(state, id));
  const assignments = useAppSelector((state) => selectAssignmentsForKhatma(state, id));
  const assignmentsListener = useAppSelector((state) =>
    selectAssignmentsListener(state, id),
  );
  const roster = useAppSelector(selectRoster);
  const surahs = useSurahs();
  const scopeMaps = useQuranScopeMaps();
  const wirdCompletions = useAppSelector((state) => selectWirdCompletions(state, id));
  const wirdCompletionsListener = useAppSelector((state) =>
    selectWirdCompletionsListener(state, id),
  );

  if (!khatma) {
    return <MissingKhatmaState hasSeries={khatmas.length > 0} />;
  }

  if (isWird(khatma)) {
    return (
      <Stack component="section" spacing={4} data-react-surface="admin" data-route="wird">
        <KhatmaBackLink />
        <WirdAdminDetail
          wird={khatma}
          roster={roster}
          surahs={surahs}
          scopeMaps={scopeMaps}
          completions={wirdCompletions}
          completionStatus={wirdCompletionsListener?.status}
        />
      </Stack>
    );
  }

  const unreadSurahIds = scopeMaps
    ? fullyUnreadSurahIds(khatma.remainingPages, scopeMaps.pageUnitMaps.surah)
    : null;
  const selectableSurahs =
    surahs && unreadSurahIds
      ? surahs.filter((surah) => unreadSurahIds.has(surah.id))
      : null;

  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="khatma">
      <KhatmaBackLink />
      <KhatmaHeaderCard khatma={khatma} assignments={assignments} roster={roster} />
      <KhatmaMetadataEditor khatma={khatma} />
      {khatma.status === 'active' ? (
        <>
          <KhatmaMembersCard
            khatma={khatma}
            khatmas={khatmas}
            assignments={assignments}
            roster={roster}
            surahs={selectableSurahs}
          />
          <ActiveKhatmaControls khatma={khatma} roster={roster} />
        </>
      ) : (
        <CompletedKhatmaControls khatma={khatma} />
      )}
      <KhatmaReadingLogCard
        assignments={assignments}
        roster={roster}
        status={assignmentsListener?.status}
      />
      <KhatmaHistoryCard khatma={khatma} khatmas={khatmas} roster={roster} />
    </Stack>
  );
}
