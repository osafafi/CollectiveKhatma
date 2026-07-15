import { useEffect, useRef, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { selectContent, useAppSelector } from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import {
  AppButton,
  AppTextField,
  ReadingScaleControl,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { ReadingScale } from '@/theme/reading';

interface AdminSettingsPageProps {
  readingScale: ReadingScale;
  onReadingScaleChange: (scale: ReadingScale) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin Settings `#/settings` (inventory §3.5) — the React twin of the legacy
 * [`settingsPage`](../../../ui/admin/pages/settings.ts): the global du3a editor
 * plus the shared reading-scale control (**P11**, reused not forked).
 *
 * The reading-scale disclosure state is lifted to `AdminRouteContent` (like the
 * member app) so it persists across route navigation; the du3a draft lives in
 * the editor and survives unrelated content snapshots via a touched guard
 * (**P3**).
 */
export function AdminSettingsPage({
  readingScale,
  onReadingScaleChange,
  open,
  onOpenChange,
}: AdminSettingsPageProps) {
  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="settings">
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.admin.navSettings}
      </Typography>
      <Du3aEditor />
      <ReadingScaleControl
        readingScale={readingScale}
        onReadingScaleChange={onReadingScaleChange}
        open={open}
        onOpenChange={onOpenChange}
      />
    </Stack>
  );
}

/**
 * The du3a2 al-khatma editor. The textarea is seeded from the live global
 * content and `save` writes it through `setDu3aText`. **P3:** once the admin
 * edits the field, incoming content snapshots must NOT overwrite the in-progress
 * text — a `touched` guard (the mirror of the member/roster draft-survival
 * pattern) freezes seeding until a successful save clears it.
 */
function Du3aEditor() {
  const content = useAppSelector(selectContent);
  const incoming = content?.du3aText ?? '';
  const save = useWriteOperation('setDu3aText');
  const [text, setText] = useState(incoming);
  const touchedRef = useRef(false);

  // Seed from live content until the admin starts editing; frozen once touched.
  useEffect(() => {
    if (!touchedRef.current) setText(incoming);
  }, [incoming]);

  const onSave = async () => {
    const settled = await save.execute(text);
    if (settled.status === 'success') touchedRef.current = false;
  };

  const status = save.state.status;

  return (
    <SurfaceCard title={strings.admin.du3aEditorHeading}>
      <Stack spacing={2}>
        <AppTextField
          multiline
          minRows={4}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            touchedRef.current = true;
          }}
          slotProps={{
            htmlInput: {
              className: 'quran-text',
              'aria-label': strings.admin.du3aEditorHeading,
            },
          }}
        />
        <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <AppButton onClick={() => void onSave()} disabled={save.isPending}>
            {strings.admin.save}
          </AppButton>
          {/*
            Intentional a11y delta (inventory §1.7): the legacy shows only the
            green `saved` note. A save failure surfaces an error-tone `alert`
            here so it is not announced as success; success keeps `role="status"`.
          */}
          {status === 'success' ? (
            <Typography role="status" color="success.main">
              {strings.admin.saved}
            </Typography>
          ) : status === 'failure' ? (
            <Typography role="alert" color="error.main">
              {strings.admin.saveError}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}
