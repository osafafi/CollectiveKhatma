import { useEffect, useState } from 'react';
import { localDateIso } from '@/domain/wird';

/** React local day that advances while a long-lived member tab stays open. */
export function useLocalDate(): string {
  const [date, setDate] = useState(localDateIso);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const now = new Date();
      const next = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        50,
      );
      timer = setTimeout(() => {
        setDate(localDateIso());
        schedule();
      }, next.getTime() - now.getTime());
    };
    schedule();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);
  return date;
}
