import { createContext } from 'react';
import type { QariId } from '@/content/quran/recitation';
import type { RecitationEngine } from './recitationEngine';

export interface RecitationContextValue {
  engine: RecitationEngine;
  /** The member's chosen voice on this device. */
  qariId: QariId;
  setQariId: (qariId: QariId) => void;
}

export const RecitationContext = createContext<RecitationContextValue | null>(null);
