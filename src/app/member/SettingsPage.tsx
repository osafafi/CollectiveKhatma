import { useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import {
  AppButton,
  AppTextField,
  ReadingScaleControl,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { personAvatar } from '@/domain/personAppearance';
import type { Person } from '@/domain/types';
import type { ReadingScale } from '@/theme/reading';
import { useMemberIdentity } from './memberIdentityContext';
import { MemberFeedbackSection } from './MemberFeedbackSection';

interface SettingsPageProps {
  readingScale: ReadingScale;
  onReadingScaleChange: (scale: ReadingScale) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedbackOpen: boolean;
  onFeedbackOpenChange: (open: boolean) => void;
}

/** Member reading-scale settings with route-stable disclosure state. */
export function SettingsPage({
  readingScale,
  onReadingScaleChange,
  open,
  onOpenChange,
  feedbackOpen,
  onFeedbackOpenChange,
}: SettingsPageProps) {
  const { member } = useMemberIdentity();

  return (
    <Stack spacing={4}>
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.nav.settings}
      </Typography>
      {member ? <AvatarEditor key={member.id} person={member} /> : null}
      <ReadingScaleControl
        readingScale={readingScale}
        onReadingScaleChange={onReadingScaleChange}
        open={open}
        onOpenChange={onOpenChange}
      />
      <MemberFeedbackSection open={feedbackOpen} onOpenChange={onFeedbackOpenChange} />
    </Stack>
  );
}

function AvatarEditor({ person }: { person: Person }) {
  const updatePerson = useWriteOperation('updatePerson');
  const [emoji, setEmoji] = useState(person.emoji ?? '');
  const normalizedEmoji = emoji.trim();
  const preview = personAvatar({
    name: person.name,
    emoji: normalizedEmoji || undefined,
  });

  const onSave = () =>
    updatePerson.execute(person.id, { emoji: normalizedEmoji || undefined });

  return (
    <SurfaceCard title={strings.settings.avatarTitle}>
      <Stack spacing={2}>
        <Typography
          aria-label={strings.settings.avatarPreview}
          sx={{ fontFamily: 'system-ui, sans-serif', fontSize: '2rem', lineHeight: 1 }}
        >
          {preview}
        </Typography>
        <AppTextField
          label={strings.settings.avatarLabel}
          helperText={strings.settings.avatarHelper}
          value={emoji}
          fieldWidth={180}
          onChange={(event) => {
            setEmoji(event.target.value);
            updatePerson.reset();
          }}
          slotProps={{ htmlInput: { maxLength: 16 } }}
        />
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <AppButton onClick={() => void onSave()} disabled={updatePerson.isPending}>
            {strings.settings.saveAvatar}
          </AppButton>
          {updatePerson.state.status === 'success' ? (
            <Typography role="status" color="success.main">
              {strings.settings.avatarSaved}
            </Typography>
          ) : updatePerson.state.status === 'failure' ? (
            <Typography role="alert" color="error.main">
              {strings.settings.avatarSaveError}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}
