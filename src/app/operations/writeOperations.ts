import {
  clearRoundDone,
  clearWarning,
  markRoundDone,
  ReleasedChunkError,
} from '@/data/assignments';
import { setDu3aText } from '@/data/content';
import {
  deleteFeedback,
  setFeedbackRead,
  submitFeedback,
} from '@/data/feedbackOperations';
import type {
  CommitDistributionRunParams,
  DistributionOutcome,
  RunDistributionParams,
} from '@/data/distribution';
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
import {
  addPerson,
  DuplicatePersonNameError,
  removePerson,
  renamePerson,
  updatePerson,
} from '@/data/roster';
import { disableSelfAndReleasePages } from '@/data/personStatus';

/** Feature-facing errors and results exposed without leaking the data layer. */
export { DuplicatePersonNameError, ReleasedChunkError };
export type { DistributionOutcome };

type RunDistribution = (params: RunDistributionParams) => Promise<DistributionOutcome>;
type CommitDistributionRun = (
  params: CommitDistributionRunParams,
) => Promise<DistributionOutcome>;

// Distribution planning is admin-only and comparatively large. Keep both
// transaction adapters out of the member's initial bundle.
const runDistribution: RunDistribution = async (params) =>
  (await import('@/data/distribution')).runDistribution(params);
const commitDistributionRun: CommitDistributionRun = async (params) =>
  (await import('@/data/distribution')).commitDistributionRun(params);

/** Every Firestore mutation available to React features through the data boundary. */
export interface WriteOperations {
  addPerson: typeof addPerson;
  renamePerson: typeof renamePerson;
  updatePerson: typeof updatePerson;
  disableSelfAndReleasePages: typeof disableSelfAndReleasePages;
  removePerson: typeof removePerson;
  setDu3aText: typeof setDu3aText;
  submitFeedback: typeof submitFeedback;
  setFeedbackRead: typeof setFeedbackRead;
  deleteFeedback: typeof deleteFeedback;
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
  runDistribution: RunDistribution;
  commitDistributionRun: CommitDistributionRun;
}

/** Production adapter. Tests can replace it through {@link WriteOperationsProvider}. */
export const writeOperations: WriteOperations = Object.freeze({
  addPerson,
  renamePerson,
  updatePerson,
  disableSelfAndReleasePages,
  removePerson,
  setDu3aText,
  submitFeedback,
  setFeedbackRead,
  deleteFeedback,
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
  commitDistributionRun,
});
