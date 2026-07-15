# Quran Khatma Tracker

A static **React + TypeScript** web app for organizing collective Quran
khatmas (group readings where the 604 pages are split among members). It
replaces a manual, WhatsApp-based process with automatic page assignment and
live progress tracking, built for a **non-tech-savvy, senior** audience.

It ships as two apps in one static site — a **member app** (`index.html`) and an
unguessable-URL **admin app** — talking directly to **Firebase/Firestore** with
no server or Cloud Functions. See [REQUIREMENTS.md](REQUIREMENTS.md) for the full
product spec and [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organized.

> **Status:** The member and hidden admin production entries run on React. The
> migration branch is in final cleanup and end-to-end validation; see the
> [migration tracker](docs/react-migration/TRACKER.md).

## Tech stack

| Concern     | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Language    | TypeScript (strict)                                               |
| UI          | React + Material UI (MUI), Redux Toolkit, React Router            |
| Build/dev   | [Vite](https://vite.dev) (multi-page app)                         |
| Backend     | Firebase / Cloud Firestore (client SDK only — no Cloud Functions) |
| Tests       | [Vitest](https://vitest.dev)                                      |
| Lint/format | ESLint (flat config) + Prettier                                   |
| Hosting     | Static site → GitHub Pages                                        |

## Prerequisites

- **Node.js 24.18.0 LTS.** The repository's `.nvmrc`, package metadata, CI, and
  deployment workflow all use this exact version. With a compatible version
  manager, run `nvm install` and `nvm use` from the repository root.
- For running the local **Firestore emulator** (recommended for development):
  - **Java (JDK 11+)** — required by the emulator. Install e.g.
    [Temurin](https://adoptium.net/) (`winget install EclipseAdoptium.Temurin.21.JDK` on Windows).
  - **Firebase CLI**: `npm install -g firebase-tools`.

You do **not** need Java or a real Firebase project just to build, typecheck,
lint, or test the app.

## Quick start

```bash
npm install
cp .env.example .env        # emulator-only dev works with the defaults as-is

# Terminal 1 — start the Firestore emulator (needs Java + Firebase CLI)
npm run emulators

# Terminal 2 — seed a few roster members, then run the dev server
npm run seed
npm run dev
```

Open the printed URL (default http://localhost:5173). The member page shows the
seeded roster live; the admin page is at `/admin-nano.html` (see
[Admin URL](#admin-url--security)).

> Without the emulator running, the app still loads — the roster simply shows
> "no members yet" (Firestore returns an empty offline snapshot).

The production member and hidden admin pages both mount React. Development-only
preview aliases remain available for local comparison and are excluded from the
deployable Vite inputs; bundle budgets are measured from the production manifest.

## npm scripts

| Script                         | What it does                                                  |
| ------------------------------ | ------------------------------------------------------------- |
| `npm run dev`                  | Vite dev server with hot reload                               |
| `npm run build`                | Typecheck, then build the static site to `dist/`              |
| `npm run check:bundle-budgets` | Build production and enforce member/admin initial-load limits |
| `npm run preview`              | Serve the built `dist/` locally                               |
| `npm run typecheck`            | `tsc --noEmit`                                                |
| `npm run lint`                 | ESLint (includes the layer guardrails)                        |
| `npm run format`               | Prettier write                                                |
| `npm test`                     | Run the Vitest unit tests                                     |
| `npm run emulators`            | Start the Firestore emulator + Emulator UI (port 4000)        |
| `npm run seed`                 | Seed roster + default du3a into the running emulator          |
| `npm run build:quran`          | (Re)generate the bundled Quran dataset under `public/quran/`  |

## Firebase setup

### Option A — emulator only (fastest, fully offline)

The defaults in `.env.example` use the project id `demo-khatma`. Any `demo-*`
id runs entirely in the emulator with no real Firebase project or billing. This
is all you need for local development — just `npm run emulators`.

### Option B — a real Firebase project (for deployment)

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Firestore Database → Create database** (Spark/free tier is enough).
3. **Project settings → General → Your apps →** add a **Web app**, then copy the
   `firebaseConfig` values into your `.env` (`VITE_FIREBASE_*`).
4. Deploy the security rules (see below).

> The `VITE_FIREBASE_*` web config is **not secret** — it is compiled into the
> public client bundle by design. Security comes from Firestore rules, not from
> hiding the config. See [ARCHITECTURE.md](ARCHITECTURE.md#security).

### Deploying Firestore rules

Rules live in [`firestore.rules`](firestore.rules) and are version-controlled.
The production workflow deploys them before publishing the matching GitHub Pages
build. One-time GitHub/Google Cloud setup:

1. Create a deploy service account in `collectivekhatma` with the Firebase Rules
   Admin role (`roles/firebaserules.admin`).
2. Configure a Workload Identity Federation provider restricted to this GitHub
   repository and allow it to impersonate that service account.
3. Under **Settings → Secrets and variables → Actions → Variables**, add:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`: the provider's full resource name, using
     project number `476780851513` (for example,
     `projects/476780851513/locations/global/workloadIdentityPools/<pool>/providers/<provider>`).
   - `GCP_SERVICE_ACCOUNT`: the deploy service-account email.

For an intentional manual deployment from an authenticated machine, run:

```bash
npm run deploy:rules
```

## Building & deploying to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds and publishes to GitHub Pages on every push to `main`.

1. **Repo → Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Add your Firebase web config as **repository secrets** (`VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_PROJECT_ID`, …). They are injected at build time.
3. Set the **base path**. For a project site
   (`https://<user>.github.io/<repo>/`), `BASE_PATH` must be `/<repo>/` — it is
   set to `/CollectiveKhatma/` in `deploy.yml`; change it to match your repo, or remove it
   for a user/custom-domain site.

CI (typecheck + lint + test + build) runs on PRs via
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Admin URL & security

The admin app is a **separate static file with an unguessable name**
(`admin-nano.html`). There is no login — this obscurity plus community
trust is the accepted security model (REQUIREMENTS §3, §8). Before deploying:

- Replace the slug in **both** the HTML filename and `ADMIN_ENTRY` in
  [`vite.config.ts`](vite.config.ts) with your own random string.
- Never link to the admin page from the member app.

Read the honest security note in [ARCHITECTURE.md](ARCHITECTURE.md#security)
before relying on this.

## Quran data

The full **Madinah mushaf** (King Fahd / KFGQPC layout, Hafs Uthmani) is bundled:
604 page-accurate JSON files plus surah metadata, under
[`public/quran/`](public/quran/). Pages are the atomic unit used for assignment;
surah metadata (`surahs.json`, first/last page per chapter) lets the admin assign
a page range, a whole chapter, or both.

- **Regenerate** with `npm run build:quran`
  ([`scripts/build-quran-data.ts`](scripts/build-quran-data.ts)), which fetches
  once from the [quran.com API](https://api.quran.com) and rewrites the JSON. The
  app itself has **no runtime dependency** on any Quran API — it reads the
  committed files. Text source: KFGQPC/Tanzil Uthmani via quran.com — community,
  non-commercial use; keep attribution.
- **Font:** [Amiri Quran](https://github.com/alif-type/amiri) (SIL OFL 1.1),
  bundled at [`src/theme/fonts/AmiriQuran.woff2`](src/theme/fonts/AmiriQuran.woff2)
  and wired via `@font-face` in
  [`src/theme/globalStyles.ts`](src/theme/globalStyles.ts). It
  renders the Uthmani text with its symbols (ornate ayah medallions, pause/waqf
  marks). To use the official **KFGQPC Uthmanic Hafs** font instead, drop it in
  beside that file and update the `src` (mind its license).
- **Rendering:** ayah-end medallions come from
  [`src/content/quran/symbols.ts`](src/content/quran/symbols.ts); reading text
  reflows and scales with the font-size slider.

## What is built

The app includes the round-based assignment engine, live member reading and
completion flows, roster and khatma administration, progress dashboards,
du3a/settings controls, bundled paged Quran reader, browser persistence, and
responsive Arabic RTL member/admin surfaces. Remaining migration validation is
tracked in [the React migration tracker](docs/react-migration/TRACKER.md).
