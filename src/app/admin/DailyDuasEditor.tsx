import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { DailyDuasConflictError, useWriteOperation } from '@/app/operations';
import { selectContent, selectContentListener, useAppSelector } from '@/app/store';
import { selectDailyDu3as } from '@/app/store/dailyDuaSelectors';
import {
  AppButton,
  AppTextField,
  CollapsibleCard,
  ConfirmationDialog,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { MAX_DAILY_DUAS, MAX_DAILY_DUA_LENGTH, validDailyDuas } from '@/domain/dailyDua';

interface Draft {
  items: string[];
  expected: string[] | null;
}

export function DailyDuasEditor() {
  const incoming = useAppSelector(selectDailyDu3as);
  const content = useAppSelector(selectContent);
  const listener = useAppSelector(selectContentListener);
  const save = useWriteOperation('setDailyDu3as');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<number | 'reload' | null>(null);
  const items = draft?.items ?? incoming;
  const valid = validDailyDuas(items);
  const disabled = save.isPending || listener.status !== 'ready';

  const change = (next: string[]) => {
    setDraft({
      items: next,
      expected: draft ? draft.expected : (content?.dailyDu3as ?? null),
    });
    save.reset();
  };
  const onSave = async () => {
    const result = await save.execute(
      [...items],
      draft ? draft.expected : (content?.dailyDu3as ?? null),
    );
    if (result.status === 'success') {
      setDraft(null);
      setEditing(null);
    }
  };

  return (
    <CollapsibleCard
      title={strings.dailyDua.settingsTitle}
      open={open}
      onOpenChange={setOpen}
      summaryEnd={items.length}
    >
      {open && (
        <Stack spacing={3}>
          <Typography color="text.secondary">{strings.dailyDua.description}</Typography>
          {items.length === 0 && <Typography>{strings.dailyDua.empty}</Typography>}
          <Stack spacing={2} sx={{ maxHeight: '60vh', overflowY: 'auto', p: 0.5 }}>
            {items.map((text, index) => (
              <Box
                key={index}
                sx={(theme) => ({
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                  background: theme.custom.cardBg,
                })}
              >
                <Stack spacing={2}>
                  <Typography variant="caption" color="text.secondary">
                    {index + 1}
                  </Typography>
                  {editing === index ? (
                    <AppTextField
                      multiline
                      minRows={3}
                      fullWidth
                      autoFocus
                      label={strings.dailyDua.text}
                      value={text}
                      disabled={disabled}
                      onChange={(event) =>
                        change(
                          items.map((item, i) =>
                            i === index ? event.target.value : item,
                          ),
                        )
                      }
                      slotProps={{
                        htmlInput: {
                          className: 'quran-text',
                          maxLength: MAX_DAILY_DUA_LENGTH,
                        },
                      }}
                    />
                  ) : (
                    <Box
                      component="p"
                      className="quran-text"
                      sx={{
                        m: 0,
                        overflowWrap: 'anywhere',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {text}
                    </Box>
                  )}
                  <Stack direction="row" spacing={2}>
                    <AppButton
                      variant="outlined"
                      disabled={disabled}
                      onClick={() => setEditing(editing === index ? null : index)}
                    >
                      {editing === index ? strings.common.done : strings.dailyDua.edit}
                    </AppButton>
                    <AppButton
                      color="error"
                      variant="outlined"
                      disabled={disabled}
                      onClick={() => setConfirmation(index)}
                    >
                      {strings.dailyDua.remove}
                    </AppButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <AppButton
              disabled={disabled || items.length >= MAX_DAILY_DUAS}
              onClick={() => {
                change([...items, '']);
                setEditing(items.length);
              }}
            >
              {strings.dailyDua.add}
            </AppButton>
            <AppButton disabled={disabled || !valid} onClick={() => void onSave()}>
              {strings.dailyDua.save}
            </AppButton>
            {draft && (
              <AppButton
                variant="outlined"
                disabled={disabled}
                onClick={() => setConfirmation('reload')}
              >
                {strings.dailyDua.reload}
              </AppButton>
            )}
          </Stack>
          {!valid && (
            <Typography role="alert" color="error.main">
              {strings.dailyDua.invalid}
            </Typography>
          )}
          {save.state.status === 'success' && (
            <Typography role="status" color="success.main">
              {strings.admin.saved}
            </Typography>
          )}
          {(listener.status === 'error' || save.state.status === 'failure') && (
            <Typography role="alert" color="error.main">
              {save.state.error instanceof DailyDuasConflictError
                ? strings.dailyDua.conflict
                : strings.admin.saveError}
            </Typography>
          )}
        </Stack>
      )}
      <ConfirmationDialog
        open={confirmation !== null}
        message={
          confirmation === 'reload'
            ? strings.dailyDua.reloadConfirm
            : strings.dailyDua.deleteConfirm
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation === 'reload') {
            setDraft(null);
            save.reset();
          } else if (confirmation !== null)
            change(items.filter((_, i) => i !== confirmation));
          setEditing(null);
          setConfirmation(null);
        }}
      />
    </CollapsibleCard>
  );
}
