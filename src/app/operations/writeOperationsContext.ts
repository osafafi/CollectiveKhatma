import { createContext } from 'react';
import { writeOperations, type WriteOperations } from './writeOperations';

export const WriteOperationsContext = createContext<WriteOperations>(writeOperations);
