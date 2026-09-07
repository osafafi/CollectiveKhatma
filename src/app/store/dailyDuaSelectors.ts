import { validDailyDuas } from '@/domain/dailyDua';
import { selectContent } from './selectors';
import type { RootState } from './store';

const EMPTY_DUAS: readonly string[] = [];

export function selectDailyDu3as(state: RootState): readonly string[] {
  const saved = selectContent(state)?.dailyDu3as;
  return validDailyDuas(saved) ? saved : EMPTY_DUAS;
}
