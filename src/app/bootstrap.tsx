import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

const REACT_ROOT_ID = 'app';

export function mountReactApp(app: ReactNode) {
  const container = document.getElementById(REACT_ROOT_ID);

  if (!container) {
    throw new Error(`React root #${REACT_ROOT_ID} was not found.`);
  }

  createRoot(container).render(<StrictMode>{app}</StrictMode>);
}
