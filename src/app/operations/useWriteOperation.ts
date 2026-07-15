import { useContext } from 'react';
import { WriteOperationsContext } from './writeOperationsContext';
import { useOperation, type UseOperationResult } from './useOperation';
import type { WriteOperations } from './writeOperations';

export type WriteOperationName = keyof WriteOperations;
export type WriteOperationArguments<Name extends WriteOperationName> = Parameters<
  WriteOperations[Name]
>;
export type WriteOperationResult<Name extends WriteOperationName> = Awaited<
  ReturnType<WriteOperations[Name]>
>;

/** Select one typed data-layer mutation and attach local operation feedback. */
export function useWriteOperation<Name extends WriteOperationName>(
  name: Name,
): UseOperationResult<WriteOperationArguments<Name>, WriteOperationResult<Name>> {
  const operation = useContext(WriteOperationsContext)[name] as unknown as (
    ...args: WriteOperationArguments<Name>
  ) => Promise<WriteOperationResult<Name>>;
  return useOperation(operation);
}
