import { useEffect } from 'react';
import { Stack, Typography } from '@mui/material';
import { CollapsibleCard } from '@/components/primitives';
import { QariPicker, VerseOverlapControl } from '@/components/recitation';
import { isQariId, QARIS, VERSE_OVERLAP_MS } from '@/content/quran/recitation';
import { strings } from '@/content/strings.ar';
import { previewPlaylist, transitionPreviewPlaylist } from './recitationPlaylist';
import { useRecitation, useRecitationSnapshot } from './useRecitation';

const PREVIEW_OWNER = 'settings-preview';
const TRANSITION_OWNER = 'settings-transition';

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
 * device, and each row previews Ayat al-Kursi. An advanced subsection tunes
 * the chosen voice's overlap between ayat, with a test across ayah boundaries.
 * One preview plays at a time, and it stops when the section closes or the
 * member leaves Settings.
 */
export function QariSettingsCard({ open, onOpenChange }: QariSettingsCardProps) {
  const { engine, qariId, setQariId, overlapMsFor, setOverlapMs } = useRecitation();
  const snapshot = useRecitationSnapshot();
  const sounding = snapshot.status === 'loading' || snapshot.status === 'playing';
  const previewActive = snapshot.owner === PREVIEW_OWNER && sounding;
  const previewId = previewActive ? snapshot.qariId : undefined;
  const testing = snapshot.owner === TRANSITION_OWNER && sounding;
  const overlapMs = overlapMsFor(qariId);

  useEffect(() => {
    if (open) return;
    engine.stop(PREVIEW_OWNER);
    engine.stop(TRANSITION_OWNER);
  }, [engine, open]);

  useEffect(
    () => () => {
      engine.stop(PREVIEW_OWNER);
      engine.stop(TRANSITION_OWNER);
    },
    [engine],
  );

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

  const onTestTransition = (): void => {
    if (testing) {
      engine.stop(TRANSITION_OWNER);
      return;
    }
    engine.start({
      owner: TRANSITION_OWNER,
      kind: 'preview',
      qariId,
      playlist: transitionPreviewPlaylist(),
      overlapSeconds: overlapMs / 1000,
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
        <VerseOverlapControl
          qariName={strings.recitation.qariNames[qariId]}
          valueMs={overlapMs}
          onChange={(ms) => setOverlapMs(qariId, ms)}
          onReset={() => setOverlapMs(qariId, VERSE_OVERLAP_MS.default)}
          testing={testing}
          testLoading={testing && snapshot.status === 'loading' && !snapshot.index}
          onTest={onTestTransition}
        />
        <Typography variant="caption" color="text.secondary" dir="auto">
          {strings.recitation.credit}
        </Typography>
      </Stack>
    </CollapsibleCard>
  );
}
