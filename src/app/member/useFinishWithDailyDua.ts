import { useContext } from 'react';
import { useFinishRound, type FinishRoundTarget } from '@/app/operations';
import { selectAssignmentsForKhatma, useAppSelector } from '@/app/store';
import { selectDailyDu3as } from '@/app/store/dailyDuaSelectors';
import { dailyDuaForDate, dailyDuaRoundDate } from '@/domain/dailyDua';
import { DailyDuaContext } from './dailyDuaContext';

/** The callback captures the prayer at tap time; later snapshots cannot change it. */
export function useFinishWithDailyDua(target: FinishRoundTarget) {
  const show = useContext(DailyDuaContext);
  const duas = useAppSelector(selectDailyDu3as);
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, target.khatmaId),
  );
  const text = dailyDuaForDate(duas, dailyDuaRoundDate(assignments, target.round));
  return useFinishRound({
    ...target,
    onAccepted: () => {
      if (text) show(text);
    },
  });
}
