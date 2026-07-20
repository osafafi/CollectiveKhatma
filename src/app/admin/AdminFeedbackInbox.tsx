import { useId, useState, type ReactNode } from 'react';
import { Box, Dialog, Stack, Typography } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import { useConfirmation } from '@/app/providers/useConfirmation';
import { useSnackbar } from '@/app/providers/useSnackbar';
import { useAppSelector } from '@/app/store';
import {
  selectFeedback,
  selectFeedbackListener,
  selectUnreadFeedbackCount,
} from '@/app/store/feedbackSelectors';
import { useFeedbackSubscription } from '@/app/store/useFeedbackSubscription';
import { NestedSurface } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import type { MemberFeedback } from '@/domain/types';

/** Edit this value to change how much viewport height the top drawer occupies. */
export const ADMIN_FEEDBACK_DRAWER_HEIGHT_PERCENT = 70;

/** Persistent admin feedback notification, badge, and top-opening inbox drawer. */
export function AdminFeedbackInbox() {
  useFeedbackSubscription();
  const [open, setOpen] = useState(false);
  const [drawerOrigin, setDrawerOrigin] = useState({ x: 0, y: 0 });
  const drawerTitleId = useId();
  const unreadCount = useAppSelector(selectUnreadFeedbackCount);
  const feedback = useAppSelector(selectFeedback);
  const listener = useAppSelector(selectFeedbackListener);
  const notificationLabel = `${strings.admin.feedbackNotifications}: ${toArabicDigits(
    unreadCount,
  )} ${strings.admin.unreadFeedback}`;

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={notificationLabel}
        onClick={(event) => {
          const iconBounds = event.currentTarget.getBoundingClientRect();
          setDrawerOrigin({
            x: iconBounds.left + iconBounds.width / 2,
            y: iconBounds.top + iconBounds.height / 2,
          });
          setOpen(true);
        }}
        sx={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'grid',
          width: 44,
          height: 44,
          p: 0,
          placeItems: 'center',
          border: 0,
          borderRadius: '50%',
          bgcolor: 'transparent',
          color: 'text.primary',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box
          component="span"
          sx={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }}
        >
          <BellIcon />
          {unreadCount > 0 ? (
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                position: 'absolute',
                top: -7,
                right: -9,
                display: 'grid',
                minWidth: 18,
                height: 18,
                px: 0.5,
                placeItems: 'center',
                borderRadius: 9,
                bgcolor: 'error.main',
                color: 'error.contrastText',
                fontSize: '0.6875rem',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {toArabicDigits(unreadCount)}
            </Box>
          ) : null}
        </Box>
      </Box>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth={false}
        aria-labelledby={drawerTitleId}
        sx={{
          '& .MuiDialog-container': {
            position: 'relative',
            alignItems: 'flex-start',
          },
          '& .MuiDialog-paper': {
            position: 'absolute',
            top: `${drawerOrigin.y}px`,
            insetInlineStart: `${drawerOrigin.x}px`,
            insetInlineEnd: `${drawerOrigin.x}px`,
            width: 'auto',
            maxWidth: 'none',
            height: `${ADMIN_FEEDBACK_DRAWER_HEIGHT_PERCENT}vh`,
            maxHeight: `${ADMIN_FEEDBACK_DRAWER_HEIGHT_PERCENT}vh`,
            m: 0,
            borderRadius: '24px 24px 24px 24px',
            transformOrigin: '0 0',
            animation: 'feedbackDrawerIn 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          },
          '@keyframes feedbackDrawerIn': {
            from: { transform: 'scale(0)', opacity: 0 },
            to: { transform: 'scale(1)', opacity: 1 },
          },
        }}
      >
        <Box sx={{ height: '100%', overflowY: 'auto', p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3} sx={{ width: 'min(100%, 896px)', mx: 'auto' }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography id={drawerTitleId} component="h2" variant="h3">
                {strings.admin.feedbackInboxHeading}
              </Typography>
              <IconActionButton
                label={strings.admin.closeFeedback}
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </IconActionButton>
            </Stack>

            {listener.status === 'error' ? (
              <Typography role="alert" color="error.main">
                {strings.admin.feedbackLoadError}
              </Typography>
            ) : listener.status !== 'ready' ? (
              <Typography color="text.secondary">
                {strings.admin.feedbackLoading}
              </Typography>
            ) : feedback.length === 0 ? (
              <Typography color="text.secondary">{strings.admin.noFeedback}</Typography>
            ) : (
              <Stack spacing={2}>
                {feedback.map((item) => (
                  <FeedbackMessage key={item.id} feedback={item} />
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </Dialog>
    </>
  );
}

function FeedbackMessage({ feedback }: { feedback: MemberFeedback }) {
  const setFeedbackRead = useWriteOperation('setFeedbackRead');
  const deleteFeedback = useWriteOperation('deleteFeedback');
  const { confirm } = useConfirmation();
  const { enqueueSnackbar } = useSnackbar();
  const busy = setFeedbackRead.isPending || deleteFeedback.isPending;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedback.message);
      enqueueSnackbar(strings.admin.feedbackCopied, { severity: 'success' });
    } catch {
      enqueueSnackbar(strings.admin.feedbackCopyError, { severity: 'error' });
    }
  };

  const onDelete = async () => {
    if (!(await confirm(strings.admin.confirmDeleteFeedback))) return;
    await deleteFeedback.execute(feedback.id);
  };

  const actionFailed =
    setFeedbackRead.state.status === 'failure' ||
    deleteFeedback.state.status === 'failure';

  return (
    <NestedSurface sx={{ borderRadius: '15px' }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <Stack direction="row" spacing={5} sx={{ alignItems: 'center' }}>
            <Typography component="h1" sx={{ fontWeight: feedback.isRead ? 600 : 800 }}>
              {feedback.memberName}
            </Typography>
            {!feedback.isRead ? (
              <Typography variant="body2" color="error.main">
                {strings.admin.unreadFeedback}
              </Typography>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconActionButton
              label={
                feedback.isRead
                  ? strings.admin.markFeedbackUnread
                  : strings.admin.markFeedbackRead
              }
              disabled={busy}
              onClick={() => void setFeedbackRead.execute(feedback.id, !feedback.isRead)}
            >
              {feedback.isRead ? <UnreadIcon /> : <ReadIcon />}
            </IconActionButton>
            <IconActionButton
              label={strings.admin.copyFeedback}
              onClick={() => void onCopy()}
            >
              <CopyIcon />
            </IconActionButton>
            <IconActionButton
              label={strings.admin.deleteFeedback}
              color="error.main"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              <DeleteIcon />
            </IconActionButton>
          </Stack>
        </Stack>
        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {feedback.message}
        </Typography>
        {actionFailed ? (
          <Typography role="alert" color="error.main">
            {strings.admin.feedbackActionError}
          </Typography>
        ) : null}
      </Stack>
    </NestedSurface>
  );
}

interface IconActionButtonProps {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}

function IconActionButton({
  label,
  children,
  onClick,
  disabled = false,
  color = 'text.primary',
}: IconActionButtonProps) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'grid',
        width: 40,
        height: 40,
        p: 0,
        placeItems: 'center',
        border: 0,
        borderRadius: '50%',
        bgcolor: 'transparent',
        color,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        '&:hover': disabled ? undefined : { bgcolor: 'action.hover' },
      }}
    >
      {children}
    </Box>
  );
}

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function BellIcon() {
  return (
    <LineIcon>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </LineIcon>
  );
}

function CloseIcon() {
  return (
    <LineIcon>
      <path d="m6 6 12 12M18 6 6 18" />
    </LineIcon>
  );
}

function CopyIcon() {
  return (
    <LineIcon>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </LineIcon>
  );
}

function ReadIcon() {
  return (
    <LineIcon>
      <path d="M3 7 12 13 21 7" />
      <path d="M21 12v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14" />
      <path d="m15 10 2 2 4-4" />
    </LineIcon>
  );
}

function UnreadIcon() {
  return (
    <LineIcon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7 12 13 21 7" />
    </LineIcon>
  );
}

function DeleteIcon() {
  return (
    <LineIcon>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </LineIcon>
  );
}
