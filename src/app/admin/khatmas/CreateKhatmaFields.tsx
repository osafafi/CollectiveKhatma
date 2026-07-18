import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { SeriesImagePicker } from '@/app/admin/SeriesImagePicker';
import {
  AppButton,
  AppCheckboxField,
  AppSelectField,
  AppTextField,
  SurfaceCard,
  type SelectOption,
} from '@/components/primitives';
import { toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import type { Surah } from '@/content/quran/types';
import { findSeriesByName, nextSeriesNumber } from '@/domain/series';
import type { Khatma, MemberCapacity, Person } from '@/domain/types';
import { CreateKhatmaCapacityRow } from './CreateKhatmaCapacityRow';
import { CreateKhatmaScopeControls } from './CreateKhatmaScopeControls';
import { requiredDraftCapacity, type CreateKhatmaDraft } from './createKhatmaDraft';

interface CreateKhatmaFieldsProps {
  draft: CreateKhatmaDraft;
  setDraft: Dispatch<SetStateAction<CreateKhatmaDraft>>;
  khatmas: readonly Khatma[];
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
  busy: boolean;
  error: string;
  onCreate: () => void;
  onCancel: () => void;
}

/** Visible create form. Draft ownership stays in the route-scoped form controller. */
export function CreateKhatmaFields({
  draft,
  setDraft,
  khatmas,
  roster,
  surahs,
  busy,
  error,
  onCreate,
  onCancel,
}: CreateKhatmaFieldsProps) {
  const selected = roster.filter((person) => draft.memberIds.has(person.id));
  const matchingSeries = findSeriesByName(khatmas, draft.seriesName);
  const matchingImageName = matchingSeries
    ? khatmas.find(
        (candidate) =>
          candidate.seriesId === matchingSeries.seriesId && candidate.imageName,
      )?.imageName
    : undefined;

  const toggleMember = (person: Person, checked: boolean) => {
    setDraft((current) => {
      const memberIds = new Set(current.memberIds);
      const memberCaps = { ...current.memberCaps };
      if (checked) {
        memberIds.add(person.id);
        memberCaps[person.id] =
          memberIds.size === 1
            ? { pages: 0, surahs: 0, juz: 1 }
            : { pages: person.pagesPerDay, surahs: 0, juz: 0 };
      } else {
        memberIds.delete(person.id);
        delete memberCaps[person.id];
      }
      return { ...current, memberIds, memberCaps };
    });
  };

  const setCapacity = (memberId: string, patch: Partial<MemberCapacity>) => {
    setDraft((current) => {
      const base = requiredDraftCapacity(current, memberId);
      return {
        ...current,
        memberCaps: { ...current.memberCaps, [memberId]: { ...base, ...patch } },
      };
    });
  };

  const reciterOptions: SelectOption[] = [
    { value: '', label: strings.admin.reciterAuto },
    ...selected.map((person) => ({ value: person.id, label: person.name })),
  ];
  const reciterValue = draft.memberIds.has(draft.reciterId) ? draft.reciterId : '';

  return (
    <SurfaceCard title={strings.admin.createHeading}>
      <Stack spacing={3}>
        <AppTextField
          label={strings.admin.seriesNamePlaceholder}
          value={draft.seriesName}
          onChange={(event) =>
            setDraft((current) => ({ ...current, seriesName: event.target.value }))
          }
        />
        <SeriesContinuationNote khatmas={khatmas} name={draft.seriesName} />
        <SeriesImagePicker
          value={draft.imageName ?? matchingImageName ?? ''}
          disabled={busy}
          onChange={(imageName) => setDraft((current) => ({ ...current, imageName }))}
        />

        <FieldGroup label={strings.admin.scopeLabel}>
          <CreateKhatmaScopeControls draft={draft} setDraft={setDraft} surahs={surahs} />
        </FieldGroup>

        <FieldGroup label={strings.admin.membersLabel}>
          {roster.length === 0 ? (
            <Typography color="text.secondary">{strings.admin.emptyRoster}</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {roster.map((person) => (
                <AppCheckboxField
                  key={person.id}
                  checked={draft.memberIds.has(person.id)}
                  onChange={(checked) => toggleMember(person, checked)}
                  label={
                    person.enabled
                      ? `${person.emoji || ''} ${person.name}`
                      : `${person.emoji || ''} ${person.name} (${strings.admin.disabledBadge})`
                  }
                />
              ))}
            </Box>
          )}
        </FieldGroup>

        {selected.length > 0 ? (
          <FieldGroup label={strings.admin.capacityLabel}>
            <Stack spacing={2}>
              {selected.map((person) => (
                <CreateKhatmaCapacityRow
                  key={person.id}
                  person={person}
                  capacity={requiredDraftCapacity(draft, person.id)}
                  surahs={surahs}
                  onChange={(patch) => setCapacity(person.id, patch)}
                />
              ))}
            </Stack>
          </FieldGroup>
        ) : null}

        <AppSelectField
          label={strings.admin.reciterLabel}
          value={reciterValue}
          options={reciterOptions}
          onChange={(value) => setDraft((current) => ({ ...current, reciterId: value }))}
        />

        <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <AppTextField
            type="date"
            label={strings.admin.createdDateLabel}
            value={draft.createdDate}
            fieldWidth={200}
            onChange={(event) =>
              setDraft((current) => ({ ...current, createdDate: event.target.value }))
            }
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <AppTextField
            type="number"
            label={strings.admin.khatmaNumberLabel}
            value={draft.seriesNumberOverride}
            fieldWidth={120}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                seriesNumberOverride: event.target.value,
              }))
            }
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <AppButton disabled={busy} onClick={onCreate}>
            {strings.admin.createButton}
          </AppButton>
          <AppButton variant="text" quiet color="inherit" onClick={onCancel}>
            {strings.admin.cancel}
          </AppButton>
        </Stack>

        {error ? (
          <Typography role="alert" color="error.main">
            {error}
          </Typography>
        ) : null}
      </Stack>
    </SurfaceCard>
  );
}

function SeriesContinuationNote({
  khatmas,
  name,
}: {
  khatmas: readonly Khatma[];
  name: string;
}) {
  const existing = findSeriesByName(khatmas, name);
  if (!existing) return null;
  const next = nextSeriesNumber(khatmas, existing.seriesId);
  return (
    <Typography variant="body2" color="text.secondary">
      {`${strings.admin.continuesSeries} ${toArabicDigits(next)}`}
    </Typography>
  );
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack spacing={1}>
      <Typography component="span" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}
