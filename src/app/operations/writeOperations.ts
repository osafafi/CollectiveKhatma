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
  setSeriesImage,
  updateKhatma,
} from '@/data/khatmas';
import { addPerson, removePerson, renamePerson, updatePerson } from '@/data/roster';

/** Every Firestore mutation available to React features through the data boundary. */
export interface WriteOperations {
  addPerson: typeof addPerson;
  renamePerson: typeof renamePerson;
  updatePerson: typeof updatePerson;
  removePerson: typeof removePerson;
  setDu3aText: typeof setDu3aText;
  createKhatma: typeof createKhatma;
  setSeriesImage: typeof setSeriesImage;
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
  renamePerson,
  updatePerson,
  removePerson,
  setDu3aText,
  createKhatma,
  setSeriesImage,
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
