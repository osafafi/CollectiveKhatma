import { Box, Stack, Typography } from '@mui/material';
import { shallowEqual } from 'react-redux';
import type { ReactNode } from 'react';
import { useDu3aAcknowledgement } from '@/app/persistence';
import {
  selectAssignmentsForKhatma,
  selectContent,
  selectKhatmas,
  selectPersonById,
  useAppSelector,
} from '@/app/store';
import { AppButton } from '@/components/primitives';
import { DEFAULT_DU3A_TEXT, strings } from '@/content/strings.ar';
import { khatmaProgress } from '@/domain/progress';
import type { Khatma } from '@/domain/types';
import { useMemberIdentity } from './memberIdentityContext';

interface MemberCompletionInterruptProps {
  children: ReactNode;
}

/**
 * Replace every member route with the first unacknowledged completion.
 * Assignment subscriptions remain mounted above this boundary, while the shell
 * (including any reader and all navigation) is torn down until acknowledgement.
 */
export function MemberCompletionInterrupt({ children }: MemberCompletionInterruptProps) {
  const { memberId } = useMemberIdentity();
  const completedKhatmas = useAppSelector(
    (state) =>
      selectKhatmas(state).filter(
        (khatma) =>
          khatma.status === 'active' &&
          khatma.memberIds.includes(memberId) &&
          khatmaProgress(khatma, selectAssignmentsForKhatma(state, khatma.id)).complete,
      ),
    shallowEqual,
  );

  return (
    <PendingCompletion
      khatmas={completedKhatmas}
      index={0}
      memberId={memberId}
      fallback={children}
    />
  );
}

interface PendingCompletionProps {
  khatmas: readonly Khatma[];
  index: number;
  memberId: string;
  fallback: ReactNode;
}

function PendingCompletion({
  khatmas,
  index,
  memberId,
  fallback,
}: PendingCompletionProps) {
  const khatma = khatmas[index];
  if (!khatma) return fallback;

  return (
    <CompletionCandidate
      key={khatma.id}
      khatma={khatma}
      memberId={memberId}
      next={
        <PendingCompletion
          khatmas={khatmas}
          index={index + 1}
          memberId={memberId}
          fallback={fallback}
        />
      }
    />
  );
}

function CompletionCandidate({
  khatma,
  memberId,
  next,
}: {
  khatma: Khatma;
  memberId: string;
  next: ReactNode;
}) {
  const [acknowledged, acknowledge] = useDu3aAcknowledgement(khatma.id);
  const content = useAppSelector(selectContent);
  const reciterId = khatma.duaReciterId;
  const reciter = useAppSelector((state) =>
    reciterId ? selectPersonById(state, reciterId) : undefined,
  );

  if (acknowledged) return next;

  const showsDu3a = !reciterId || reciterId === memberId;
  return (
    <Box
      component="main"
      data-react-surface="member"
      data-route="completion"
      sx={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
      }}
    >
      <Stack
        spacing={6}
        sx={{ mx: 'auto', width: '100%', maxWidth: 576, textAlign: 'center' }}
      >
        <Typography component="h1" variant="h2" color="primary.main">
          {strings.member.khatmaComplete}
        </Typography>

        {showsDu3a ? (
          <>
            <Typography component="h2" variant="h3">
              {strings.member.du3aHeading}
            </Typography>
            <Box component="p" className="quran-text" sx={{ m: 0 }}>
              {content?.du3aText ?? DEFAULT_DU3A_TEXT}
            </Box>
          </>
        ) : (
          <Typography component="p" variant="subtitle1">
            {strings.member.reciterLead}:{' '}
            <Typography component="span" sx={{ fontWeight: 600 }}>
              {reciter?.name ?? ''}
            </Typography>
          </Typography>
        )}

        <AppButton onClick={acknowledge} sx={{ alignSelf: 'center' }}>
          {strings.common.done}
        </AppButton>
      </Stack>
    </Box>
  );
}
