# Shared UI brick

Owns: reusable controls, cards, feedback, charts, navigation, icons, MUI RTL theme, copy.

Start files:

- UI: `src/components/`
- Theme: `src/theme/`
- Arabic copy: `src/content/strings.ar.ts`
- Icons: `src/components/icons/`, `public/icons/`

Consumers: admin and member apps.

Tests: `tests/components/**`, `tests/theme/**`, then hit feature tests.

Hard rules:

- Shared UI imports no `app` and no `data`.
- User-facing Arabic text comes from the strings module.
- A feature wording change updates that feature doc, not this doc.
- Public asset URLs use `import.meta.env.BASE_URL`.
- RTL theme and Emotion cache cover portals.
- Keep visible focus, semantic status contrast, mobile nav clearance, desktop RTL rail.
- Reading scale is shared and persisted.

Update this doc when shared component API, theme contract, global copy ownership,
icon rule, or accessibility changes.
