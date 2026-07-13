import { HashRouter } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

/** Shared static-host-safe router boundary for both React entry points. */
export function AppHashRouter({ children }: PropsWithChildren) {
  return <HashRouter>{children}</HashRouter>;
}
