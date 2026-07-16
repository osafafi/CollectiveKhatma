import {
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import {
  selectAssignmentsForKhatma,
  selectKhatmas,
  selectRoster,
  useAppSelector,
} from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import { AdminRouteLink } from '@/app/routing/RouteLink';
import { useQuranScopeMaps } from '@/app/admin/useQuranScopeMaps';
import { useSurahs } from '@/app/admin/useSurahs';
import {
  useCreateKhatmaPrefill,
  type CreateKhatmaPrefill,
} from '@/app/admin/createKhatmaPrefillContext';
import { SurahCapacitySelect } from '@/app/admin/SurahCapacitySelect';
import {
  AppButton,
  AppCheckboxField,
  AppSelectField,
  AppTextField,
  StatusChip,
  SurfaceCard,
  type SelectOption,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import type { Surah } from '@/content/quran/types';
import { resolvePageScope } from '@/domain/assignment';
import { khatmaProgress } from '@/domain/progress';
import { pickDuaReciter } from '@/domain/rotation';
import { findSeriesByName, nextSeriesNumber, seriesTitle } from '@/domain/series';
import {
  type Khatma,
  type MemberCapacity,
  type PageScope,
  type Person,
} from '@/domain/types';

/**
 * Admin Khatmas `#/khatmas` (inventory §3.3). List-first: every khatma (active
 * before completed) links to its detail page, and a gated create form
 * collects the series name, scope, member picker, per-member additive capacity,
 * reciter, and optional backfill.
 *
 * The whole create form is a single lifted draft (`draft` state on this page):
 * because the page stays mounted while live Firestore snapshots re-render it, the
 * scope/member/capacity/reciter selections survive those snapshots (**P2**), and
 * they also survive the create-form show/hide toggle. Reset only on a successful
 * create. The draft is route-scoped (the RM-510 delta); RM-550 formalizes the
 * cross-form model.
 */
export function AdminKhatmasPage() {
  const khatmas = useAppSelector(selectKhatmas);

  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="admin"
      data-route="khatmas"
    >
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.admin.navKhatmas}
      </Typography>
      <KhatmasList khatmas={khatmas} />
      <CreateArea khatmas={khatmas} />
    </Stack>
  );
}

// -----------------------------------------------------------------------------
// List of all khatmas (active first, then completed), newest `createdAt` first.
// -----------------------------------------------------------------------------

function KhatmasList({ khatmas }: { khatmas: readonly Khatma[] }) {
  if (khatmas.length === 0) {
    return (
      <SurfaceCard title={strings.admin.khatmasHeading}>
        <Typography color="text.secondary">{strings.admin.noActive}</Typography>
      </SurfaceCard>
    );
  }
  const ordered = [...khatmas].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  return (
    <SurfaceCard title={strings.admin.khatmasHeading}>
      <Stack spacing={0}>
        {ordered.map((khatma) => (
          <KhatmaListLine key={khatma.id} khatma={khatma} />
        ))}
      </Stack>
    </SurfaceCard>
  );
}

function KhatmaListLine({ khatma }: { khatma: Khatma }) {
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatma.id),
  );
  const percent =
    khatma.status === 'completed' ? 100 : khatmaProgress(khatma, assignments).percent;

  return (
    <Link
      component={AdminRouteLink}
      to={{ name: 'khatma', id: khatma.id }}
      underline="none"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: 1,
        borderColor: 'divider',
        py: 2,
      }}
    >
      <Typography component="span" sx={{ flex: 1, fontWeight: 600 }} color="primary.main">
        {seriesTitle(khatma, toArabicDigits)}
      </Typography>
      <StatusChip
        size="small"
        tone={khatma.status === 'active' ? 'primary' : 'neutral'}
        label={
          khatma.status === 'active'
            ? strings.admin.statusActive
            : strings.admin.statusCompleted
        }
      />
      <Typography
        component="span"
        variant="body2"
        color="text.secondary"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {`${toArabicDigits(percent)}٪`}
      </Typography>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Create: gated behind a button (list-first), revealed as a full draft form.
// -----------------------------------------------------------------------------

interface CreateDraft {
  seriesName: string;
  scopeKind: PageScope['kind'];
  rangeFrom: string;
  rangeTo: string;
  surahIds: Set<number>;
  memberIds: Set<string>;
  memberCaps: Record<string, MemberCapacity>;
  reciterId: string;
  createdDate: string;
  seriesNumberOverride: string;
}

function emptyCreateDraft(): CreateDraft {
  return {
    seriesName: '',
    scopeKind: 'full',
    rangeFrom: '1',
    rangeTo: '604',
    surahIds: new Set(),
    memberIds: new Set(),
    memberCaps: {},
    reciterId: '',
    createdDate: '',
    seriesNumberOverride: '',
  };
}

function CreateArea({ khatmas }: { khatmas: readonly Khatma[] }) {
  const roster = useAppSelector(selectRoster);
  const scopeMaps = useQuranScopeMaps();
  const surahs = useSurahs();
  const createKhatma = useWriteOperation('createKhatma');
  const { peekPrefill, clearPrefill } = useCreateKhatmaPrefill();

  // Seed synchronously from any `startNext` prefill (no flash of the collapsed
  // form), then drop it in an effect so a later ordinary visit does not re-open.
  // `peekPrefill` is a pure read, so a StrictMode double-invoked initializer sees
  // the same value both times.
  const [initialPrefill] = useState<CreateKhatmaPrefill | null>(peekPrefill);
  useEffect(() => clearPrefill(), [clearPrefill]);

  const [showCreateForm, setShowCreateForm] = useState(initialPrefill !== null);
  const [draft, setDraft] = useState<CreateDraft>(() =>
    initialPrefill ? draftFromPrefill(initialPrefill) : emptyCreateDraft(),
  );
  const [error, setError] = useState('');

  if (!showCreateForm) {
    return (
      <Box>
        <AppButton onClick={() => setShowCreateForm(true)}>
          {strings.admin.createNewButton}
        </AppButton>
      </Box>
    );
  }

  const selected = roster.filter((person) => draft.memberIds.has(person.id));

  const toggleMember = (person: Person, checked: boolean) => {
    setDraft((current) => {
      const memberIds = new Set(current.memberIds);
      const memberCaps = { ...current.memberCaps };
      if (checked) {
        memberIds.add(person.id);
        // First-selected member defaults to one juz (solo reader); later members
        // use their roster pace. The choice is stored as soon as they are selected.
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

  const onCreate = async () => {
    setError('');
    const name = draft.seriesName.trim();
    if (!name) {
      setError(strings.admin.seriesNameRequired);
      return;
    }
    const ids = [...draft.memberIds];
    if (ids.length === 0) {
      setError(strings.admin.selectMembers);
      return;
    }
    const scope = buildScope(draft);
    let pool: number[];
    try {
      if (!scope) throw new Error('invalid');
      pool = resolvePageScope(scope, scopeMaps?.surahToPages);
    } catch (cause) {
      console.error('onCreate: scope resolution failed', cause);
      setError(strings.admin.createError);
      return;
    }

    // Same name = same series, next number; otherwise a brand-new series.
    const existing = findSeriesByName(khatmas, name);
    const seriesId = existing?.seriesId ?? safeUUID();
    const autoNumber = existing ? nextSeriesNumber(khatmas, seriesId) : 1;
    const override = parseInt(draft.seriesNumberOverride, 10);
    const seriesNumber =
      Number.isInteger(override) && override > 0 ? override : autoNumber;
    const reciter = draft.memberIds.has(draft.reciterId)
      ? draft.reciterId
      : pickDuaReciter(ids, khatmas);
    const capacities = buildCapacities(draft, ids);
    const createdAt = dateToEpoch(draft.createdDate);

    const result = await createKhatma.execute({
      seriesId,
      seriesName: existing?.seriesName ?? name,
      seriesNumber,
      totalPages: pool.length,
      scope,
      memberIds: ids,
      remainingPages: pool,
      duaReciterId: reciter,
      capacities,
      ...(createdAt !== undefined ? { createdAt } : {}),
    });

    if (result.status === 'success') {
      setDraft(emptyCreateDraft());
      setShowCreateForm(false);
      setError('');
    } else {
      console.error('onCreate: createKhatma failed', result.error);
      setError(strings.admin.createError);
    }
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

        <FieldGroup label={strings.admin.scopeLabel}>
          <ScopeControls draft={draft} setDraft={setDraft} surahs={surahs} />
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
                <CapacityRow
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
          <AppButton onClick={() => void onCreate()}>
            {strings.admin.createButton}
          </AppButton>
          <AppButton
            variant="text"
            quiet
            color="inherit"
            onClick={() => setShowCreateForm(false)}
          >
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

/** When the typed name matches an existing series, say which number comes next. */
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

function ScopeControls({
  draft,
  setDraft,
  surahs,
}: {
  draft: CreateDraft;
  setDraft: Dispatch<SetStateAction<CreateDraft>>;
  surahs: readonly Surah[] | null;
}) {
  const scopeOptions: SelectOption[] = [
    { value: 'full', label: strings.admin.scopeFull },
    { value: 'range', label: strings.admin.scopeRange },
    { value: 'surahs', label: strings.admin.scopeSurahs },
  ];
  return (
    <Stack spacing={2}>
      <AppSelectField
        label={strings.admin.scopeLabel}
        value={draft.scopeKind}
        options={scopeOptions}
        onChange={(value) =>
          setDraft((current) => ({ ...current, scopeKind: value as PageScope['kind'] }))
        }
      />
      {draft.scopeKind === 'range' ? (
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <AppTextField
            type="number"
            label={strings.admin.fromPage}
            value={draft.rangeFrom}
            fieldWidth={110}
            onChange={(event) =>
              setDraft((current) => ({ ...current, rangeFrom: event.target.value }))
            }
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
          <AppTextField
            type="number"
            label={strings.admin.toPage}
            value={draft.rangeTo}
            fieldWidth={110}
            onChange={(event) =>
              setDraft((current) => ({ ...current, rangeTo: event.target.value }))
            }
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
        </Stack>
      ) : null}
      {draft.scopeKind === 'surahs' ? (
        surahs === null ? (
          <Typography color="text.secondary">{strings.common.loading}</Typography>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              maxHeight: 224,
              overflowY: 'auto',
              borderRadius: 3,
              bgcolor: 'background.default',
              p: 2,
            }}
          >
            {surahs.map((surah) => (
              <AppCheckboxField
                key={surah.id}
                checked={draft.surahIds.has(surah.id)}
                onChange={(checked) =>
                  setDraft((current) => {
                    const surahIds = new Set(current.surahIds);
                    if (checked) surahIds.add(surah.id);
                    else surahIds.delete(surah.id);
                    return { ...current, surahIds };
                  })
                }
                label={`${toArabicDigits(surah.id)}. ${surah.name}`}
              />
            ))}
          </Box>
        )
      ) : null}
    </Stack>
  );
}

/** Per-selected-member additive capacity: loose pages + one whole surah + whole juz. */
function CapacityRow({
  person,
  capacity,
  surahs,
  onChange,
}: {
  person: Person;
  capacity: MemberCapacity;
  surahs: readonly Surah[] | null;
  onChange: (patch: Partial<MemberCapacity>) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
      <Typography component="span" sx={{ width: 112, flexShrink: 0, fontWeight: 600 }}>
        {person.emoji || ''} {person.name}
      </Typography>
      <AppTextField
        type="number"
        label={strings.admin.capacityPages}
        value={String(capacity.pages)}
        fieldWidth={96}
        onChange={(event) => onChange({ pages: toCount(event.target.value) })}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <SurahCapacitySelect
        surahs={surahs}
        value={capacity.surahs}
        onChange={(surahId) => onChange({ surahs: surahId })}
      />
      <AppTextField
        type="number"
        label={strings.admin.capacityJuz}
        value={String(capacity.juz)}
        fieldWidth={96}
        onChange={(event) => onChange({ juz: toCount(event.target.value) })}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
    </Box>
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

// -----------------------------------------------------------------------------
// Draft helpers (pure).
// -----------------------------------------------------------------------------

/** Clamp a text numeric field to a non-negative integer, like the legacy capacity fields. */
function toCount(value: string): number {
  return Math.max(0, parseInt(value, 10) || 0);
}

function buildScope(draft: CreateDraft): PageScope | null {
  switch (draft.scopeKind) {
    case 'full':
      return { kind: 'full' };
    case 'range': {
      const fromPage = parseInt(draft.rangeFrom, 10);
      const toPage = parseInt(draft.rangeTo, 10);
      if (!Number.isInteger(fromPage) || !Number.isInteger(toPage)) return null;
      if (fromPage < 1 || toPage < fromPage) return null;
      return { kind: 'range', fromPage, toPage };
    }
    case 'surahs': {
      const surahIds = [...draft.surahIds].sort((a, b) => a - b);
      if (surahIds.length === 0) return null;
      return { kind: 'surahs', surahIds };
    }
  }
}

function buildCapacities(
  draft: CreateDraft,
  ids: string[],
): Record<string, MemberCapacity> {
  const out: Record<string, MemberCapacity> = {};
  for (const id of ids) {
    out[id] = requiredDraftCapacity(draft, id);
  }
  return out;
}

function requiredDraftCapacity(draft: CreateDraft, memberId: string): MemberCapacity {
  const capacity = draft.memberCaps[memberId];
  if (!capacity) throw new Error(`Missing draft capacity for member ${memberId}`);
  return capacity;
}

function draftFromPrefill(prefill: CreateKhatmaPrefill): CreateDraft {
  const base = emptyCreateDraft();
  return {
    ...base,
    seriesName: prefill.seriesName,
    memberIds: new Set(prefill.memberIds),
    memberCaps: Object.fromEntries(
      Object.entries(prefill.memberCaps).map(([id, cap]) => [id, { ...cap }]),
    ),
    reciterId: prefill.reciterId,
    ...scopeToDraftFields(prefill.scope),
  };
}

function scopeToDraftFields(scope: PageScope): Partial<CreateDraft> {
  if (scope.kind === 'range') {
    return {
      scopeKind: 'range',
      rangeFrom: String(scope.fromPage),
      rangeTo: String(scope.toPage),
      surahIds: new Set(),
    };
  }
  if (scope.kind === 'surahs') {
    return {
      scopeKind: 'surahs',
      rangeFrom: '1',
      rangeTo: '604',
      surahIds: new Set(scope.surahIds),
    };
  }
  return { scopeKind: 'full', rangeFrom: '1', rangeTo: '604', surahIds: new Set() };
}

/** Local midnight of a YYYY-MM-DD string as epoch ms, or undefined if unset/invalid. */
function dateToEpoch(date: string): number | undefined {
  if (!date) return undefined;
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
