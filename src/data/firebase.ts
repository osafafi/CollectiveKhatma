import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase initialization — the single entry point to Firestore for the whole
 * app. Only modules under `src/data/` may import `firebase/*` (enforced by
 * eslint); every other layer uses the typed functions in this folder.
 *
 * The web config below is NOT secret — it ships in the client bundle by design.
 * Security is enforced by Firestore rules, not by hiding it. See
 * ARCHITECTURE.md#security.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);

// Whether to talk to the local Firestore emulator instead of the real project.
// - VITE_USE_EMULATOR=true  -> always emulator (default for dev, see .env)
// - VITE_USE_EMULATOR=false -> always the real project (even during `npm run dev`)
// - unset                   -> emulator in dev, real project in production builds
const emulatorFlag = import.meta.env.VITE_USE_EMULATOR;
const useEmulator =
  emulatorFlag === 'true' || (emulatorFlag == null && import.meta.env.DEV);

if (useEmulator) {
  const host = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
  const port = Number(import.meta.env.VITE_EMULATOR_PORT ?? '8080');
  connectFirestoreEmulator(db, host, port);
}
