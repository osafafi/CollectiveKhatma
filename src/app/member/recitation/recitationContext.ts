import { createContext } from 'react';
import type { QariId } from '@/content/quran/recitation';
import type { RecitationEngine } from './recitationEngine';

export interface RecitationContextValue {
  engine: RecitationEngine;
  /** The member's chosen voice on this device. */
  qariId: QariId;
  setQariId: (qariId: QariId) => void;
  /** The tail overlap (ms) for a voice: the member's tuning, else the default. */
  overlapMsFor: (qariId: QariId) => number;
  setOverlapMs: (qariId: QariId, ms: number) => void;
}

export const RecitationContext = createContext<RecitationContextValue | null>(null);
