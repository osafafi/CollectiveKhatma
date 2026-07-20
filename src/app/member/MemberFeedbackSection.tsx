import { useState } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import { AppButton, AppTextField } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import {
  FEEDBACK_MAX_CHARACTERS,
  isValidFeedbackMessage,
  normalizeFeedbackMessage,
} from '@/domain/feedback';
import { useMemberIdentity } from './memberIdentityContext';

interface MemberFeedbackSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Collapsible member-to-admin feedback form. */
export function MemberFeedbackSection({
  open,
  onOpenChange,
}: MemberFeedbackSectionProps) {
  const { memberId, member } = useMemberIdentity();
  const submitFeedback = useWriteOperation('submitFeedback');
  const [message, setMessage] = useState('');
  const normalizedMessage = normalizeFeedbackMessage(message);
  const canSubmit =
    member !== undefined && isValidFeedbackMessage(message) && !submitFeedback.isPending;
  const characterCount = `${toArabicDigits(message.length)} / ${toArabicDigits(
    FEEDBACK_MAX_CHARACTERS,
  )}`;

  const onSubmit = async () => {
    if (!member) return;
    const outcome = await submitFeedback.execute(
      memberId,
      member.name,
      normalizedMessage,
    );
    if (outcome.status === 'success') setMessage('');
  };

  return (
    <Paper
      component="details"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      variant="outlined"
      sx={{ overflow: 'hidden', borderRadius: 3 }}
    >
      <Box
        component="summary"
        sx={{
          cursor: 'pointer',
          px: 4,
          py: 3,
          color: 'primary.main',
          fontSize: '1.125rem',
          fontWeight: 700,
          userSelect: 'none',
        }}
      >
        {strings.settings.feedbackTitle}
      </Box>
      <Stack spacing={2} sx={{ borderTop: 1, borderColor: 'divider', p: 4 }}>
        <AppTextField
          label={strings.settings.feedbackLabel}
          value={message}
          multiline
          minRows={4}
          error={message.length > 0 && !isValidFeedbackMessage(message)}
          helperText={strings.settings.feedbackHelper}
          onChange={(event) => {
            setMessage(event.target.value);
            submitFeedback.reset();
          }}
          slotProps={{ htmlInput: { maxLength: FEEDBACK_MAX_CHARACTERS } }}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          aria-label={strings.settings.feedbackCharacterCount}
        >
          {characterCount}
        </Typography>
        <Box>
          <AppButton onClick={() => void onSubmit()} disabled={!canSubmit}>
            {strings.settings.sendFeedback}
          </AppButton>
        </Box>
        {submitFeedback.state.status === 'success' ? (
          <Typography role="status" color="success.main">
            {strings.settings.feedbackSent}
          </Typography>
        ) : submitFeedback.state.status === 'failure' ? (
          <Typography role="alert" color="error.main">
            {strings.settings.feedbackSendError}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
