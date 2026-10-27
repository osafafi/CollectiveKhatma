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
  `primaryBtnGradient(mode)`, the gold `goldCardBg` variant, separate blue Wird
  tokens (`wird`/`wirdSoft`/`wirdInk`, `wirdHeroGrad`/`wirdCardBg`, and blue hero
  glow/shimmer),
  the recited-ayah glow stops `ayahGlowTop`/`ayahGlowBottom` with
  `RADII.ayah`, and the per-mode `MEDALS` bronze/silver/gold
  hi/mid/lo stops (`theme.custom.medals`; decorative fills only, so no
  contrast floor). No literal colors/radii/shadows/durations in component code —
  components read `theme.palette` and `theme.custom` only.
- `createKhatmaTheme(mode, { cardStrength?, cardAngle? })` builds the theme per
  mode; there is no theme singleton. `AppThemeProvider` owns the persisted mode
  (`khatma.themeMode`, light default), exposes `useThemeSettings()`
  (app layer), and syncs the `theme-color` meta. Card-gradient params default
  subtle/160° with no user-facing control.
- `retainedGlobalStyles(theme)` is a function of the theme: fonts (UNCHANGED —
  local Amiri Quran/Scheherazade, `--font-ui` Tajawal stack), mode-aware focus
  ring and `color-scheme`, `.quran-text`, `.ayah-marker` (gold Quran-font ayah
  glyph), the redesign keyframes (fadeUp/shimmer/floaty/ringIn/glint), and a
  `prefers-reduced-motion` kill-switch. `glint` users park the band off-face at
  rest so the kill-switch leaves no band showing.
- The card gradient reaches cards and dialog paper, but never `NestedSurface`,
  ring centers, or the tab bar (those remain pinned solid). Contrast floors are
  theme-test guarded in BOTH modes.

Component recipes:

- `HeroHeader` (navigation): emerald gradient hero, pure props
  (eyebrow/title/avatar/action/children); `heroBleedSx` cancels the shell
  padding. `tone="wird"` swaps in the blue `wirdHeroGrad` and blue glow/shimmer
  for daily Wird; contrast tests cover the gradient and overlapping decoration,
  including the translucent eyebrow text, above 4.5:1 in both modes.
  Wird hero controls use the light hero ink for visible keyboard focus.
  `CollapsibleCard`: native details/summary card with rotating chevron, lifted
  open state, optional `summaryEnd` and heading level.
- `SurfaceCard` takes `appear` for the staggered fadeUp entry and an optional
  `titleEnd` for the far end of the title row (outside the heading, so the
  card's accessible name stays the title); a link card
  (`href`) renders its `actions` row below the link area, never inside it, so
  the actions can be links of their own; `tone="gold"` gives a gold border
  over `goldCardBg` (surface → goldSoft, text-contrast guarded); `StatusChip`
  adds the gold `accent` tone. `SurfaceCard` and `StatusChip` also accept
  `tone="wird"` for dedicated blue surfaces; card text, badges, and focus rings
  are contrast guarded in both modes. `DonutChart` = the progress ring (ringIn,
  cellRem track) and accepts an optional short center caption; `SegmentBar`
  neutral tone = cellRem; `AppNav` renders the 56×32 active pill on the bottom
  bar and the desktop rail. On mobile, the bar is fixed to the dynamic
  viewport's lower edge using `top: 100dvh` plus a self-height translation; do
  not replace that with `bottom: 0`, which can drift after toolbar or keyboard
  viewport changes in iOS 26 WebKit. The bar's list height is pinned to
  `appNavLayout.mobile.barBlockSize` (its natural 4.5rem) so other fixed layers
  can stack above it.
  `RecitationDock` (`src/components/recitation/`) is the reader's floating
  player: a round gradient play button that becomes a card bar. It uses
  `recitationDockLayout` — the same `top: 100dvh` anchor lifted past the tab
  bar, its border, the safe area and a 12px gap on mobile; beside the 96px rail
  and 24px up on desktop — and renders an in-flow spacer so page content and the
  finish button stay reachable. Verse buttons follow the page nav's book order
  (previous on the right) with mirrored skip icons. `QariPicker` and
  `RecitationUnavailableDialog` are its Settings and failure companions.

Hard rules:

- Shared UI imports no `app` and no `data`.
- User-facing Arabic text comes from the strings module.
- All generated and fixed numeric UI copy uses Western digits (`0–9`), including
  Quran reader page and ayah numbers.
- A feature wording change updates that feature doc, not this doc.
- Public asset URLs use `import.meta.env.BASE_URL`.
- RTL theme and Emotion cache cover portals.
- Keep visible focus, semantic status contrast, mobile nav clearance, desktop RTL rail.
- Reading scale is shared and persisted.
- `.ayah.is-reciting` glows with a vertical gradient of two registered
  `@property` colors (`--ayah-glow-top/-bottom`), so the outgoing and incoming
  ayah crossfade at `MOTION.base`; without `@property`, or under reduced
  motion, it snaps. `box-decoration-break: clone` rounds each wrapped line
  separately; only block padding is used so justified lines never reflow. The
  active medallion turns `goldInk` and an active bismillah turns ink (gold on
  the glow is too faint); theme tests guard ink ≥ 4.5:1 and the medallion
  ≥ 3:1 on both glow stops in both modes.
- `.sajda-overline` decorates exact Quran phrases with a thin, text-colored upper
  line that scales with the reading font and follows natural line wrapping.

Update this doc when shared component API, theme contract, global copy ownership,
icon rule, or accessibility changes.
