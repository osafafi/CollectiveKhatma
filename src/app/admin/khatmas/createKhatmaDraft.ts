import type { CreateKhatmaPrefill } from '@/app/admin/createKhatmaPrefillContext';
import type { MemberCapacity, PageScope } from '@/domain/types';

export interface CreateKhatmaDraft {
  seriesName: string;
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
    memberIds: new Set(),
    memberCaps: {},
    reciterId: '',
    createdDate: '',
    seriesNumberOverride: '',
    imageName: null,
  };
}

export function buildKhatmaScope(): PageScope {
  return { kind: 'full' };
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
  };
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
