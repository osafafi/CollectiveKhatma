/// <reference types="vite/client" />

/**
 * Typed access to the Firebase web config and dev flags exposed via Vite's
 * `import.meta.env`. These VITE_* values are injected at build time.
 *
 * NOTE: the Firebase web config below is NOT secret — it ships in the client
 * bundle by design. Security is enforced by Firestore rules, not by hiding it.
 * See ARCHITECTURE.md#security.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;

  /** When 'true' (or in dev), the app talks to the local Firestore emulator. */
  readonly VITE_USE_EMULATOR?: string;
  readonly VITE_EMULATOR_HOST?: string;
  readonly VITE_EMULATOR_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
