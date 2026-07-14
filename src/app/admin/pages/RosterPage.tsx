import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
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
import { isNameUnique } from '@/domain/validation';
import type { Person } from '@/domain/types';

/**
 * Admin Roster `#/roster` (inventory §3.2) — the React twin of the legacy
 * [`rosterPage`](../../../ui/admin/pages/roster.ts): search-as-you-type over the
 * member list, per-person controls (pages/round, pause, remove), and the
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
              <PersonRow key={person.id} person={person} />
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
function PersonRow({ person }: { person: Person }) {
  const updatePerson = useWriteOperation('updatePerson');
  const removePerson = useWriteOperation('removePerson');
  const { confirm } = useConfirmation();

  const onRemove = async () => {
    const confirmed = await confirm({ message: strings.admin.confirmRemove, tone: 'danger' });
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
      <Typography
        component="span"
        sx={{
          flex: 1,
          fontWeight: 600,
          ...(person.enabled
            ? undefined
            : { color: 'text.secondary', textDecoration: 'line-through' }),
        }}
      >
        {person.name}
      </Typography>

      {person.enabled ? null : (
        <StatusChip tone="neutral" size="small" label={strings.admin.disabledBadge} />
      )}

      <NumberStepper
        label={strings.admin.pagesPerDayLabel}
        value={person.pagesPerDay}
        min={1}
        onChange={(value) => void updatePerson.execute(person.id, { pagesPerDay: value })}
      />

      <AppButton
        variant="outlined"
        onClick={() => void updatePerson.execute(person.id, { enabled: !person.enabled })}
      >
        {person.enabled ? strings.admin.disable : strings.admin.enable}
      </AppButton>

      <AppButton variant="text" quiet color="error" onClick={() => void onRemove()}>
        {strings.admin.remove}
      </AppButton>
    </Box>
  );
}

/**
 * Add-member form. Validation (`nameRequired`, `nameTaken`) is client-side and
 * shown; the `addPerson` write itself is fire-and-forget (inventory §5 quirk 5).
 * On success the name/note/error reset but the pages/round value is kept, exactly
 * as the legacy `onAddPerson` does.
 */
function AddPersonForm({ roster }: { roster: readonly Person[] }) {
  const addPerson = useWriteOperation('addPerson');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
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
      pagesPerDay: resolvedPages,
    });
    setName('');
    setNote('');
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
        <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
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
