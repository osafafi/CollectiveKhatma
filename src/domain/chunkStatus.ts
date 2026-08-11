import type { Assignment, RoundChunk } from './types';

/** Transitional compatibility for chunks written before explicit statuses existed. */
export function isChunkReleased(chunk: RoundChunk): boolean {
  return chunk.status === 'released' || chunk.released === true;
}

/** Explicit status wins; legacy round timestamps keep older documents readable. */
export function isChunkCompleted(a: Assignment, chunk: RoundChunk): boolean {
  return (
    !isChunkReleased(chunk) &&
    (chunk.status === 'completed' || a.doneByRound?.[chunk.round] !== undefined)
  );
}
