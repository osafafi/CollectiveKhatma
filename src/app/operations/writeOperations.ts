import { clearRoundDone, clearWarning, markRoundDone } from '@/data/assignments';
import { setDu3aText } from '@/data/content';
import { runDistribution } from '@/data/distribution';
import {
  addMemberToKhatma,
  completeKhatma,
  createKhatma,
  deleteKhatma,
  releaseMemberChunk,
  removeMemberFromKhatma,
  renameSeries,
  updateKhatma,
} from '@/data/khatmas';
import { addPerson, removePerson, updatePerson } from '@/data/roster';

/** Every Firestore mutation available to React features through the data boundary. */
export interface WriteOperations {
  addPerson: typeof addPerson;
  updatePerson: typeof updatePerson;
  removePerson: typeof removePerson;
  setDu3aText: typeof setDu3aText;
  createKhatma: typeof createKhatma;
  updateKhatma: typeof updateKhatma;
  renameSeries: typeof renameSeries;
  completeKhatma: typeof completeKhatma;
  addMemberToKhatma: typeof addMemberToKhatma;
  releaseMemberChunk: typeof releaseMemberChunk;
  removeMemberFromKhatma: typeof removeMemberFromKhatma;
  deleteKhatma: typeof deleteKhatma;
  markRoundDone: typeof markRoundDone;
  clearRoundDone: typeof clearRoundDone;
  clearWarning: typeof clearWarning;
  runDistribution: typeof runDistribution;
}

/** Production adapter. Tests can replace it through {@link WriteOperationsProvider}. */
export const writeOperations: WriteOperations = Object.freeze({
  addPerson,
  updatePerson,
  removePerson,
  setDu3aText,
  createKhatma,
  updateKhatma,
  renameSeries,
  completeKhatma,
  addMemberToKhatma,
  releaseMemberChunk,
  removeMemberFromKhatma,
  deleteKhatma,
  markRoundDone,
  clearRoundDone,
  clearWarning,
  runDistribution,
});
