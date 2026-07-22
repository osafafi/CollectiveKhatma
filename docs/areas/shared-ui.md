# Shared UI brick

Owns: reusable controls, cards, feedback, charts, navigation, icons, MUI RTL theme, copy.

Start files:

- UI: `src/components/`
- Theme: `src/theme/` (`tokens.ts` → `muiTheme.ts` → `globalStyles.ts`)
- Arabic copy: `src/content/strings.ar.ts`
- Icons: `src/components/icons/`, `public/icons/`

Consumers: admin and member apps.

Tests: `tests/components/**`, `tests/theme/**`, then hit feature tests.

Theme contract (redesign):

- `src/theme/tokens.ts` is the single source of style values: light + dark
  `TOKENS` maps, `RADII`, `MOTION`, `cardGradient(mode, strength, angle)`,
  `primaryBtnGradient(mode)`. No literal colors/radii/shadows/durations in
  component code — components read `theme.palette` and `theme.custom` only.
- `createKhatmaTheme(mode, { cardStrength?, cardAngle? })` builds the theme per
  mode; there is no theme singleton. `AppThemeProvider` owns the persisted mode
  (`khatma.themeMode`, light default), exposes `useThemeSettings()`
  (app layer), and syncs the `theme-color` meta. Card-gradient params default
  subtle/160° with no user-facing control.
- `retainedGlobalStyles(theme)` is a function of the theme: fonts (UNCHANGED —
  local Amiri Quran/Scheherazade, `--font-ui` Tajawal stack), mode-aware focus
  ring and `color-scheme`, `.quran-text`, `.ayah-marker` (gold Quran-font ayah
  glyph), the redesign keyframes (fadeUp/shimmer/floaty/ringIn), and a
  `prefers-reduced-motion` kill-switch.
- The card gradient never reaches `NestedSurface`, ring centers, or the tab
  bar (all pinned solid). Contrast floors are theme-test guarded in BOTH modes.

Component recipes:

- `HeroHeader` (navigation): emerald gradient hero, pure props
  (eyebrow/title/avatar/action/children); `heroBleedSx` cancels the shell
  padding. `CollapsibleCard`: native details/summary card with rotating
  chevron, lifted open state, optional `summaryEnd` and heading level.
- `SurfaceCard` takes `appear` for the staggered fadeUp entry; `StatusChip`
  adds the gold `accent` tone; `DonutChart` = the progress ring (ringIn,
  cellRem track) and accepts an optional short center caption; `SegmentBar`
  neutral tone = cellRem; `AppNav` renders the
  56×32 active pill on the bottom bar and the desktop rail.

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
