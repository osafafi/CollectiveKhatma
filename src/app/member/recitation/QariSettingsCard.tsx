import { useEffect } from 'react';
import { Stack, Typography } from '@mui/material';
import { CollapsibleCard } from '@/components/primitives';
import { QariPicker } from '@/components/recitation';
import { isQariId, QARIS } from '@/content/quran/recitation';
import { strings } from '@/content/strings.ar';
import { previewPlaylist } from './recitationPlaylist';
import { useRecitation, useRecitationSnapshot } from './useRecitation';

const PREVIEW_OWNER = 'settings-preview';

const QARI_OPTIONS = QARIS.map((qari) => ({
  id: qari.id,
  name: strings.recitation.qariNames[qari.id],
}));

interface QariSettingsCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Settings section for the recitation voice: picking a row saves it on this
 * device, and each row previews Ayat al-Kursi. One preview plays at a time,
 * and it stops when the section closes or the member leaves Settings.
 */
export function QariSettingsCard({ open, onOpenChange }: QariSettingsCardProps) {
  const { engine, qariId, setQariId } = useRecitation();
  const snapshot = useRecitationSnapshot();
  const previewActive =
    snapshot.owner === PREVIEW_OWNER &&
    (snapshot.status === 'loading' || snapshot.status === 'playing');
  const previewId = previewActive ? snapshot.qariId : undefined;

  useEffect(() => {
    if (!open) engine.stop(PREVIEW_OWNER);
  }, [engine, open]);

  useEffect(() => () => engine.stop(PREVIEW_OWNER), [engine]);

  const onPreview = (id: string): void => {
    if (!isQariId(id)) return;
    if (id === previewId) {
      engine.stop(PREVIEW_OWNER);
      return;
    }
    engine.start({
      owner: PREVIEW_OWNER,
      kind: 'preview',
      qariId: id,
      playlist: previewPlaylist(),
    });
  };

  return (
    <CollapsibleCard
      title={strings.recitation.title}
      open={open}
      onOpenChange={onOpenChange}
    >
      <Stack spacing={3}>
        <Typography color="text.secondary">{strings.recitation.description}</Typography>
        <QariPicker
          options={QARI_OPTIONS}
          value={qariId}
          onChange={(id) => {
            if (isQariId(id)) setQariId(id);
          }}
          previewId={previewId}
          previewLoading={previewActive && snapshot.status === 'loading'}
          onPreview={onPreview}
        />
        <Typography variant="caption" color="text.secondary" dir="auto">
          {strings.recitation.credit}
        </Typography>
      </Stack>
    </CollapsibleCard>
  );
}
