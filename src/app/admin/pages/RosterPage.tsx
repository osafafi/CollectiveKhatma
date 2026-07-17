import { useState } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { selectRoster, useAppSelector } from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import { useConfirmation } from '@/app/providers';
import {
  AppButton,
  AppTextField,
  NumberStepper,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { DuplicatePersonNameError } from '@/data/roster';
import { isNameUnique, normalizeName } from '@/domain/validation';
import type { Person } from '@/domain/types';

/**
 * Admin Roster `#/roster` (inventory §3.2): search-as-you-type over the member
 * list, per-person controls (pages/round, pause, remove), and the
 * add-member form.
 *
 * Drafts (the search text and the add-form fields) are component-local state;
 * because the page stays mounted while live Firestore snapshots re-render it,
 * those drafts survive the snapshot re-renders that would clobber them in a naive
 * port (inventory §3.2 / P2). A controlled search field that never remounts also
 * keeps the caret/focus across the keystroke re-render (**P4**) without the
 * legacy's manual re-focus hack.
 */
export function AdminRosterPage() {
  const roster = useAppSelector(selectRoster);
  const [search, setSearch] = useState('');
  const query = search.trim();
  const matches = query ? roster.filter((person) => person.name.includes(query)) : roster;

  return (
    <Stack component="section" spacing={4} data-react-surface="admin" data-route="roster">
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.admin.rosterHeading}
      </Typography>

      <SurfaceCard>
        <AppTextField
          type="search"
          label={strings.admin.searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {roster.length === 0 ? (
          <Typography color="text.secondary">{strings.admin.emptyRoster}</Typography>
        ) : matches.length === 0 ? (
          <Typography color="text.secondary">{strings.admin.noMatches}</Typography>
        ) : (
          <Stack component="ul" spacing={0} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {matches.map((person) => (
              <PersonRow key={person.id} person={person} roster={roster} />
            ))}
          </Stack>
        )}

        <AddPersonForm roster={roster} />
      </SurfaceCard>
    </Stack>
  );
}

/**
 * One roster row. The stepper and the pause toggle are fire-and-forget
 * `updatePerson` writes; remove confirms first, then `removePerson` — matching
 * the legacy feedback granularity (inventory §5 quirk 5): none of these surface a
 * success/error status.
 */
function PersonRow({ person, roster }: { person: Person; roster: readonly Person[] }) {
  const updatePerson = useWriteOperation('updatePerson');
  const removePerson = useWriteOperation('removePerson');
  const { confirm } = useConfirmation();
  const [renameOpen, setRenameOpen] = useState(false);

  const onRemove = async () => {
    const confirmed = await confirm({
      message: strings.admin.confirmRemove,
      tone: 'danger',
    });
    if (confirmed) void removePerson.execute(person.id);
  };

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
        borderBottom: 1,
        borderColor: 'divider',
        py: 2,
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 100,
        }}
      >
          <IconButton
            size="small"
            title={strings.admin.rename}
            aria-label={`${strings.admin.rename}: ${person.name}`}
            onClick={() => setRenameOpen(true)}
          >
            <Box
              component="svg"
              viewBox="0 0 24 24"
              aria-hidden="true"
              sx={{ width: 20, height: 20, fill: 'currentColor' }}
            >
              <path d="M4 17.25V20h2.75l8.11-8.11-2.75-2.75L4 17.25Zm15.71-7.49a1 1 0 0 0 0-1.41l-2.06-2.06a1 1 0 0 0-1.41 0l-1.61 1.61 2.75 2.75 1.62-1.6Z" />
            </Box>
          </IconButton>
        <Typography
          component="span"
          sx={{
            fontWeight: 600,
            ...(person.enabled
              ? undefined
              : { color: 'text.secondary', textDecoration: 'line-through' }),
          }}
        >
          {person.emoji || ''} {person.name}
        </Typography>
      </Box>

      {/* {person.enabled ? null : (
        <StatusChip tone="neutral" size="small" label={strings.admin.disabledBadge} />
      )} */}

      <NumberStepper
        label={strings.admin.pagesPerDayLabel}
        value={person.pagesPerDay}
        min={1}
        onChange={(value) => void updatePerson.execute(person.id, { pagesPerDay: value })}
      />

      <AppButton
      sx={{px:2}}
        variant="outlined"
        onClick={() => void updatePerson.execute(person.id, { enabled: !person.enabled })}
      >
        {person.enabled ? strings.admin.disable : strings.admin.enable}
      </AppButton>

      <IconButton
        size="small"
        color="error"
        title={strings.admin.remove}
        aria-label={`${strings.admin.remove}: ${person.name}`}
        onClick={() => void onRemove()}
      >
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>

      <RenamePersonDialog
        open={renameOpen}
        person={person}
        roster={roster}
        onClose={() => setRenameOpen(false)}
      />
    </Box>
  );
}

function RenamePersonDialog({
  open,
  person,
  roster,
  onClose,
}: {
  open: boolean;
  person: Person;
  roster: readonly Person[];
  onClose: () => void;
}) {
  const renamePerson = useWriteOperation('renamePerson');
  const [name, setName] = useState(person.name);
  const [error, setError] = useState('');

  const close = () => {
    if (renamePerson.isPending) return;
    setName(person.name);
    setError('');
    onClose();
  };

  const onConfirm = async () => {
    const normalized = normalizeName(name);
    if (!normalized) {
      setError(strings.admin.nameRequired);
      return;
    }
    const otherMembers = roster.filter((candidate) => candidate.id !== person.id);
    if (!isNameUnique(normalized, otherMembers)) {
      setError(strings.admin.nameTaken);
      return;
    }
    if (normalized === person.name) {
      close();
      return;
    }

    setError('');
    const result = await renamePerson.execute(person.id, normalized);
    if (result.status === 'success') {
      setName(normalized);
      onClose();
      return;
    }
    setError(
      result.error instanceof DuplicatePersonNameError
        ? strings.admin.nameTaken
        : strings.admin.saveError,
    );
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="xs"
      aria-labelledby={`rename-person-${person.id}`}
    >
      <DialogTitle id={`rename-person-${person.id}`}>
        {strings.admin.renameHeading}
      </DialogTitle>
      <DialogContent>
        <AppTextField
          autoFocus
          label={strings.admin.namePlaceholder}
          value={name}
          error={Boolean(error)}
          helperText={error || undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError('');
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <AppButton
          variant="text"
          color="inherit"
          disabled={renamePerson.isPending}
          onClick={close}
        >
          {strings.common.cancel}
        </AppButton>
        <AppButton disabled={renamePerson.isPending} onClick={() => void onConfirm()}>
          {strings.common.confirm}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Add-member form. Validation (`nameRequired`, `nameTaken`) is client-side and
 * shown; the `addPerson` write itself is fire-and-forget (inventory §5 quirk 5).
 * On success the name/note/emoji/error reset but the pages/round value is kept.
 */
function AddPersonForm({ roster }: { roster: readonly Person[] }) {
  const addPerson = useWriteOperation('addPerson');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [emoji, setEmoji] = useState('');
  const [pagesPerDay, setPagesPerDay] = useState('2');
  const [error, setError] = useState('');

  const onAdd = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(strings.admin.nameRequired);
      return;
    }
    if (!isNameUnique(trimmedName, roster)) {
      setError(strings.admin.nameTaken);
      return;
    }
    const parsed = parseInt(pagesPerDay, 10);
    const resolvedPages = Math.max(1, Number.isInteger(parsed) ? parsed : 2);
    void addPerson.execute({
      name: trimmedName,
      note: note.trim() || undefined,
      ...(emoji.trim() ? { emoji: emoji.trim() } : {}),
      pagesPerDay: resolvedPages,
    });
    setName('');
    setNote('');
    setEmoji('');
    setError('');
  };

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 4 }}>
      <Stack spacing={2}>
        <AppTextField
          label={strings.admin.namePlaceholder}
          value={name}
          error={Boolean(error)}
          onChange={(event) => setName(event.target.value)}
        />
        <AppTextField
          label={strings.admin.notePlaceholder}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <AppTextField
          label={strings.settings.avatarLabel}
          helperText={strings.settings.avatarHelper}
          value={emoji}
          fieldWidth={180}
          onChange={(event) => setEmoji(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 16 } }}
        />
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <AppTextField
            type="number"
            label={strings.admin.pagesPerDayLabel}
            value={pagesPerDay}
            fieldWidth={120}
            onChange={(event) => setPagesPerDay(event.target.value)}
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
          <AppButton onClick={onAdd}>{strings.admin.addPerson}</AppButton>
        </Stack>
        {error ? (
          <Typography role="alert" color="error.main">
            {error}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
