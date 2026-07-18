import type { CreateKhatmaPrefill } from '@/app/admin/createKhatmaPrefillContext';
import type { MemberCapacity, PageScope } from '@/domain/types';

export interface CreateKhatmaDraft {
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
  /** null inherits a matching series; empty string explicitly uses the placeholder. */
  imageName: string | null;
}

export function emptyCreateKhatmaDraft(): CreateKhatmaDraft {
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
    imageName: null,
  };
}

export function buildKhatmaScope(draft: CreateKhatmaDraft): PageScope | null {
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

export function buildKhatmaCapacities(
  draft: CreateKhatmaDraft,
  ids: string[],
): Record<string, MemberCapacity> {
  const capacities: Record<string, MemberCapacity> = {};
  for (const id of ids) capacities[id] = requiredDraftCapacity(draft, id);
  return capacities;
}

export function requiredDraftCapacity(
  draft: CreateKhatmaDraft,
  memberId: string,
): MemberCapacity {
  const capacity = draft.memberCaps[memberId];
  if (!capacity) throw new Error(`Missing draft capacity for member ${memberId}`);
  return capacity;
}

export function createKhatmaDraftFromPrefill(
  prefill: CreateKhatmaPrefill,
): CreateKhatmaDraft {
  const base = emptyCreateKhatmaDraft();
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

function scopeToDraftFields(scope: PageScope): Partial<CreateKhatmaDraft> {
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

export function toCount(value: string): number {
  return Math.max(0, parseInt(value, 10) || 0);
}

/** Local midnight of a YYYY-MM-DD string as epoch ms, or undefined if invalid. */
export function dateToEpoch(date: string): number | undefined {
  if (!date) return undefined;
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

export function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
