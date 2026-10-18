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
import { toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import type { Surah } from '@/content/quran/types';
import { findSeriesByName, nextSeriesNumber } from '@/domain/series';
import type { Khatma, MemberCapacity, Person, ReadingSeriesKind } from '@/domain/types';
import { WirdContentFields } from '../wird/WirdContentFields';
import { CreateKhatmaCapacityRow } from './CreateKhatmaCapacityRow';
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
  const matchingSeries = findSeriesByName(khatmas, draft.seriesName, draft.kind);
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
  const typeOptions: SelectOption[] = [
    { value: 'khatma', label: strings.admin.typeKhatma },
    { value: 'wird', label: strings.admin.typeWird },
  ];
  const memberOptions: SelectOption[] = roster.map((person) => ({
    value: person.id,
    label: person.enabled
      ? `${person.emoji || ''} ${person.name}`
      : `${person.emoji || ''} ${person.name} (${strings.admin.disabledBadge})`,
  }));

  return (
    <SurfaceCard
      title={
        draft.kind === 'wird'
          ? strings.admin.createWirdHeading
          : strings.admin.createHeading
      }
    >
      <Stack spacing={3}>
        <AppSelectField
          label={strings.admin.seriesTypeLabel}
          value={draft.kind}
          options={typeOptions}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              kind: value as ReadingSeriesKind,
              memberIds: new Set(),
              memberCaps: {},
              reciterId: '',
            }))
          }
        />
        <AppTextField
          label={
            draft.kind === 'wird'
              ? strings.admin.wirdNamePlaceholder
              : strings.admin.seriesNamePlaceholder
          }
          value={draft.seriesName}
          onChange={(event) =>
            setDraft((current) => ({ ...current, seriesName: event.target.value }))
          }
        />
        <SeriesContinuationNote
          khatmas={khatmas}
          name={draft.seriesName}
          kind={draft.kind}
        />
        <SeriesImagePicker
          value={draft.imageName ?? matchingImageName ?? ''}
          disabled={busy}
          onChange={(imageName) => setDraft((current) => ({ ...current, imageName }))}
        />

        {draft.kind === 'khatma' ? (
          <FieldGroup label={strings.admin.scopeLabel}>
            <Typography>{strings.admin.fullQuranOnly}</Typography>
          </FieldGroup>
        ) : (
          <FieldGroup label={strings.admin.wirdContentLabel}>
            <WirdContentFields
              draft={draft.wird}
              surahs={surahs}
              onChange={(wird) => setDraft((current) => ({ ...current, wird }))}
            />
          </FieldGroup>
        )}

        <FieldGroup
          label={
            draft.kind === 'wird'
              ? strings.admin.wirdMemberLabel
              : strings.admin.membersLabel
          }
        >
          {roster.length === 0 ? (
            <Typography color="text.secondary">{strings.admin.emptyRoster}</Typography>
          ) : draft.kind === 'wird' ? (
            <AppSelectField
              label={strings.admin.wirdMemberLabel}
              value={selected[0]?.id ?? ''}
              options={[{ value: '', label: strings.admin.none }, ...memberOptions]}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  memberIds: value ? new Set([value]) : new Set(),
                  memberCaps: value ? { [value]: { pages: 0, surahs: 0, juz: 0 } } : {},
                }))
              }
            />
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

        {draft.kind === 'khatma' && selected.length > 0 ? (
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

        {draft.kind === 'khatma' ? (
          <AppSelectField
            label={strings.admin.reciterLabel}
            value={reciterValue}
            options={reciterOptions}
            onChange={(value) =>
              setDraft((current) => ({ ...current, reciterId: value }))
            }
          />
        ) : null}

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
            label={
              draft.kind === 'wird'
                ? strings.admin.wirdNumberLabel
                : strings.admin.khatmaNumberLabel
            }
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
            {draft.kind === 'wird'
              ? strings.admin.createWirdButton
              : strings.admin.createButton}
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
  kind,
}: {
  khatmas: readonly Khatma[];
  name: string;
  kind: ReadingSeriesKind;
}) {
  const existing = findSeriesByName(khatmas, name, kind);
  if (!existing) return null;
  const next = nextSeriesNumber(khatmas, existing.seriesId);
  return (
    <Typography variant="body2" color="text.secondary">
      {`${
        kind === 'wird'
          ? strings.admin.continuesWirdSeries
          : strings.admin.continuesSeries
      } ${toWesternDigits(next)}`}
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
