import { createContext } from 'react';

export const DailyDuaContext = createContext<(text: string) => void>(() => undefined);
