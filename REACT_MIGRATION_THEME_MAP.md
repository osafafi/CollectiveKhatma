# React Migration — Tailwind → MUI Token & Component Map (RM-115)

**Owner:** Claude · **Task:** RM-115 · **Depends on:** RM-020 (DONE).
**Baseline:** token source at `reactmigration` HEAD `38fbe43`.

This is the design-token contract for the migration: it maps every current
Tailwind v4 theme token and every legacy UI component to its MUI equivalent, so
RM-210 (central MUI RTL theme) and RM-320 (shared primitives) can be built to
parity. It pairs with the behavior oracle
[`REACT_MIGRATION_UI_INVENTORY.md`](REACT_MIGRATION_UI_INVENTORY.md) (RM-020).

**Token source of truth:** [`src/theme/theme.css`](src/theme/theme.css). Tailwind
v4 is **CSS-first** — there is no `tailwind.config.js`; tokens live in the
`@theme { … }` block and each becomes *both* a utility (`--color-primary` →
`bg-primary`/`text-primary`) *and* a raw `var(--color-primary)`. Verified against
the compiled `dist` CSS and grep of `src/`.

> **Consumes AD-04, AD-08, AD-09; feeds OD-03, RM-210, RM-320, RM-330.**
> Nothing here changes runtime behavior — it is the input spec for those tasks.

## 0. Strategy (how MUI consumes this)

1. **Tokens → `createTheme`.** The `@theme` values (colors, radii, fonts) become
   a typed MUI theme object (`palette`, `shape`, `typography`, `spacing`,
   `breakpoints`). §2–§6.
2. **Components → MUI + `styleOverrides`/`variants`.** Legacy hand-rolled widgets
   map to MUI components with theme-level overrides so pages don't re-specify
   styles. §7.
3. **Retained CSS stays CSS** (AD-09). The Quran typography, reading scale, icon
   masks, and safe-area rules are app-specific and must **not** be forced into
   MUI — ship them via `<GlobalStyles>` or a kept stylesheet. §8.
4. **RTL** (AD-08): MUI Emotion cache with `stylis-plugin-rtl` + `dir="rtl"`;
   these tokens are direction-agnostic (already using logical props like
   `ps-2`/`inset-inline`). §6 note.
5. **Transition safety:** Tailwind is removed only after both cutovers (RM-620),
   so `theme.css`'s `@theme` and the MUI theme **coexist** and both read the same
   hex values. Until RM-620 they are two copies of one palette — see §9 risk R1.

---

## 1. Token inventory at a glance

| Group | Tokens | Where defined | MUI home |
| --- | --- | --- | --- |
| Colors | 11 active (+1 dead) | `@theme` | `palette` (§2) |
| Fonts | `--font-ui`, `--font-quran` | `@theme` + `@font-face` | `typography.fontFamily` + retained (§3) |
| Type scale | xs–3xl, 3 weights | Tailwind defaults (v4) | `typography` variants (§3) |
| Reading scale | 5 levels | `:root`/`html[data-reading-scale]` | **retained CSS** (§3.3, §8) |
| Radii | card, button | `@theme` | `shape` + overrides (§4) |
| Spacing | base `.25rem` | Tailwind default | `spacing` (§5) |
| Breakpoints | md, lg (only) | Tailwind default | `breakpoints.values` (§6) |

---

## 2. Colors → `palette`

Hex from [`theme.css`](src/theme/theme.css); "used as" = utility occurrences in
`src/ui` (grep-verified counts, HEAD `38fbe43`).

| Token | Hex | Used as (count) | MUI palette slot | Notes |
| --- | --- | --- | --- | --- |
| `--color-bg` | `#faf7f0` | `bg-bg` (14), `bg-bg/95` (1) | `background.default` | Warm paper. `/95` = sticky reader chrome → `alpha(bg,0.95)`. |
| `--color-surface` | `#ffffff` | `bg-surface` (8) | `background.paper` | Card surface. |
| `--color-ink` | `#1f2a24` | body default (no utility) | `text.primary` | Default text color; set on `body`, not via `text-ink`. |
| `--color-muted` | `#6b7280` | `text-muted` (41) | `text.secondary` | The most-used token — labels, captions, secondary lines. |
| `--color-primary` | `#0f766e` | `text-primary` (25), `bg-primary` (4), `border-primary` (2), `accent-primary` (3), `bg-primary/10` (1) | `primary.main` | Teal brand. `accent-primary` = form control accent (checkbox/range). |
| `--color-primary-strong` | `#115e59` | **0 (dead)** | `primary.dark` | Defined but unused → tree-shaken from build. Revive as `primary.dark` (hover/press) or drop — see §9 R2. |
| `--color-accent` | `#b45309` | charts only, via `var()` | `secondary.main` | Amber. Used **only** as the donut/segment "pending" color, never as a utility. |
| `--color-success` | `#15803d` | `text-success` (8), `bg-success/10` (2), `bg-success/20` (1) | `success.main` | Done banners/chips. |
| `--color-warn` | `#b45309` | `text-warn` (2), `bg-warn/10` (2) | `warning.main` | ⚠ **same hex as `--color-accent`** — yellow warnings and "pending" pages render identical amber. Keep or differentiate (§9 R3). |
| `--color-danger` | `#b91c1c` | `text-danger` (8), `bg-danger/10` (2) | `error.main` | Red warnings, destructive actions, errors. |
| `--color-border` | `#e7e2d6` | `border-border` (26), `bg-border` (2) | `divider` (+ `TextField` outline) | Hairlines, progress-bar track, donut track. |
| (Tailwind) white | `#ffffff` | `text-white` (3) | `primary.contrastText` / `common.white` | On-primary button label. |

**Alpha tints in use** (color-mix today → `alpha()` in MUI): `primary/10`,
`success/10`, `success/20`, `warn/10`, `danger/10`, `bg/95`. Map each banner/chip
background to `alpha(theme.palette.X.main, 0.1|0.2)`.

**`contrastText`:** primary/success/warn/danger fills all pair with white text in
the legacy UI — set each palette entry's `contrastText: '#fff'` so MUI doesn't
recompute a different on-color.

---

## 3. Typography → `typography` + fonts

### 3.1 Font families ⚠ bundling status

| Role | Token | Stack | Bundled? |
| --- | --- | --- | --- |
| UI | `--font-ui` | `'Tajawal', system-ui, -apple-system, 'Segoe UI', sans-serif` | ❌ **NOT bundled** — no `@font-face`, no Google Fonts link. Falls back to `system-ui` on any device without Tajawal installed. |
| Quran | `--font-quran` | `'Amiri Quran', 'Amiri', 'Scheherazade New', serif` | ✅ Bundled locally: `@font-face` → [`src/theme/fonts/AmiriQuran.woff2`](src/theme/fonts) (SIL OFL), `font-display: swap`. |

- MUI: `typography.fontFamily = 'var(--font-ui)'` (keeps the same fallback).
  `.quran-text` keeps `--font-quran` as **retained CSS** (§8), not a MUI variant.
- **Decision for RM-210 (OD-03 input):** either (a) actually bundle Tajawal
  (self-hosted `@font-face`, matches the design intent) or (b) accept the
  system-font reality and drop Tajawal from the stack. Do **not** silently ship
  a Google Fonts `<link>` — the app is otherwise zero-third-party-runtime by
  design (see icons/Quran comments). Flag whichever you pick as an intentional
  choice in the parity review. See §9 R4.

### 3.2 Type scale (Tailwind v4 defaults, from compiled CSS)

| Utility | size | line-height | Legacy semantic use | Suggested MUI variant |
| --- | --- | --- | --- | --- |
| `text-3xl` | 1.875rem | 2.25/1.875 | member gate title | `h1` |
| `text-2xl` | 1.5rem | 2/1.5 | route page `<h1>` (bold, primary) | `h1`/`h2` |
| `text-xl` | 1.25rem | 1.75/1.25 | card title `<h2>`, surah header | `h2`/`h3` |
| `text-lg` | 1.125rem | 1.75/1.125 | reader browse title, emphasis lines | `h3`/`subtitle1` |
| `text-base` | 1rem | 1.5/1 | body default | `body1` |
| `text-sm` | 0.875rem | 1.25/0.875 | secondary lines, list rows, chips | `body2` |
| `text-xs` | 0.75rem | 1/0.75 | badges, capacity labels, legends | `caption` |

Weights: `medium 500`, `semibold 600` (dominant for headings/labels),
`bold 700`. Map to `fontWeightMedium/…`; headings use 600–700 today.

> Heading colors are **`text-primary`** (teal), not default ink — set MUI heading
> variants' `color: 'primary.main'` or apply per-use, to match.

### 3.3 Reading scale (RETAINED — do not move into MUI)

Senior-audience priority feature (REQUIREMENTS §6). Mechanism:
`html[data-reading-scale='1..5']` → `--reading-scale: 0.9|1|1.15|1.3|1.5`;
`.quran-text` = `calc(1.6rem * var(--reading-scale))`, `line-height: 2.5`,
`text-align: justify; text-align-last: center`. Persisted in `khatma.readingScale`
([`src/theme/reading.ts`](src/theme/reading.ts), default `3`). ☐ Keep as retained
CSS (§8); RM-340 owns the React hook, RM-540/settings the control.

---

## 4. Radii → `shape`

| Token | Value | Used as | MUI |
| --- | --- | --- | --- |
| `--radius-button` | `0.75rem` (12px) | `rounded-button` — buttons, fields, chips, badges, pills, bars | `shape.borderRadius: 12` (MUI base) |
| `--radius-card` | `1rem` (16px) | `rounded-card` — cards/sections | `MuiCard`/`MuiPaper` override `borderRadius: 16` |
| (Tailwind) full | `9999px` | `rounded-full` — stepper ±, legend dots | per-component `borderRadius: '9999px'` |

MUI `shape.borderRadius` is a single scalar, so set it to the **button** radius
(12px, the common case) and override cards/pills where they differ.

---

## 5. Spacing → `spacing`

⚠ **Unit mismatch to reconcile.** Tailwind v4 base is `--spacing: .25rem` (4px);
utilities are integer multiples (`p-4` = 16px, `gap-2` = 8px, `w-24` = 96px).
**MUI's default `spacing(1)` is 8px.** To keep the Tailwind mental model 1:1,
set:

```ts
createTheme({ spacing: 4 }) // spacing(4) = 16px = Tailwind p-4; spacing(2)=8px=gap-2
```

Spacing values actually used (multiples of 4px): `1,2,3,4,6,8,10,16,20,24,28`
plus raw `gap-[2px]` (segment-bar gaps) and `py-1.5`. Layout landmarks to
preserve exactly:

| Legacy | px | Purpose | MUI |
| --- | --- | --- | --- |
| `pb-28` | 112 | content clearance above bottom tab bar (mobile) | `pb: 28` (with `spacing:4`) |
| `lg:pr-24` / `lg:w-24` | 96 | side-rail width + content reservation (desktop RTL) | `pr: { lg: 24 }`, rail `width: 96` |
| `lg:pb-8` | 32 | desktop bottom padding (no bar) | `pb: { lg: 8 }` |
| `max-w-xl/2xl/3xl/4xl` | 576/672/768/896 | content column widths | `maxWidth` via container tokens (§6) |
| `min-h-[70vh]` | — | centered completion/gate | `minHeight: '70vh'` |

Container widths (compiled): `xl 36rem`, `2xl 42rem`, `3xl 48rem`, `4xl 56rem`.

---

## 6. Breakpoints → `breakpoints.values`

The app uses **only two** Tailwind breakpoints (verified — no `sm:` in `src`):

| Tailwind | min-width | Role |
| --- | --- | --- |
| `md` | `48rem` = **768px** | member khatmas list → 2 columns; member column `md:max-w-2xl` |
| `lg` | `64rem` = **1024px** | bottom tab bar → right rail; content max-width + `lg:pr-24`; `.tab-bar` safe-area off |

MUI defaults differ (`md 900`, `lg 1200`), so **override** to Tailwind's px so
`up('md')`/`up('lg')` fire at the same widths:

```ts
breakpoints: { values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 } }
```

Then legacy `md:`/`lg:` map directly to `theme.breakpoints.up('md'|'lg')` /
`sx={{ … , [bp]: … }}`. RTL note: the rail is on the physical **right**
(`lg:right-0`, `lg:border-l`) — with `dir=rtl` use logical props/`Drawer`
anchor so it stays correct.

---

## 7. Component variants → MUI

Legacy widgets live in [`src/ui/shared/components.ts`](src/ui/shared/components.ts),
[`member/components.ts`](src/ui/member/components.ts),
[`shared/charts.ts`](src/ui/shared/charts.ts),
[`shared/nav.ts`](src/ui/shared/nav.ts),
[`shared/settings.ts`](src/ui/shared/settings.ts). RM-320/RM-330 build these.

### 7.1 Buttons

| Legacy | Classes | MUI mapping |
| --- | --- | --- |
| `primaryButton` (shared, compact) | `bg-primary px-4 py-2 rounded-button text-white font-semibold` | `Button variant="contained" color="primary"` |
| member `primaryButton`/`primaryLink` (hero) | `w-full … px-4 py-4 text-lg` (+`opacity-50` disabled) | `Button variant="contained" fullWidth size="large"`; link form = `component="a"` |
| `secondaryButton` | `border border-primary text-primary px-3 py-2` | `Button variant="outlined" color="primary"` |
| `linkButton` (muted/danger) | `text-sm underline text-muted|text-danger` | `Button variant="text"` / `Link`, `color="inherit"|"error"` |
| `roundButton` (stepper ±) | `h-8 w-8 rounded-full bg-bg text-primary` | `IconButton` (circular) or small square `Button` |
| reader `navButton` | `border border-primary px-3 py-1.5 text-primary` | `Button variant="outlined" size="small"` |
| `backLink`/`backToList` | `text-sm text-muted underline`, `‹ label` | `Button startIcon={<ChevronRight/>} variant="text"` (RTL: chevron points right) |

Disabled today = `opacity-50`/`opacity-40` + `disabled`; MUI's disabled styling is
close but tune opacity to match if parity-critical.

### 7.2 Surfaces & data display

| Legacy | Classes | MUI mapping |
| --- | --- | --- |
| `card` (titled/untitled) | `rounded-card border border-border bg-surface p-4 shadow-sm space-y-3`; title = `text-xl font-semibold` | `Card`/`Paper` (`variant="outlined"` + `shadow-sm`); title via `CardHeader`/`Typography h2` |
| `section` (home khatma block) | `rounded-button border border-border p-3` | nested `Paper variant="outlined"` |
| `badge` | `rounded-button bg-bg px-2 py-1 text-xs text-muted` | `Chip size="small"` (neutral) |
| status badge (active/completed) | same as badge | `Chip size="small"` |
| `warningChip` (yellow/red) | `bg-warn/10 text-warn` / `bg-danger/10 text-danger`, `⚠ name · word` | `Chip color="warning"|"error" variant` w/ `alpha` bg |
| banners: paused / awaiting / done / warning | `rounded-button bg-X/10 px-4 py-3 text-X` | `Alert severity="info"|"success"|"warning"` (custom, tinted) |
| `progressBar` | track `bg-border` + fill `bg-primary`, `h-2 rounded-button` | `LinearProgress variant="determinate"` (round caps, primary) |
| `donutChart` | hand-rolled SVG, track=border fill=primary, hero % center | **retain SVG** (RM-330) or `CircularProgress` + overlay; keep number-in-center |
| `segmentBar` | flex SVG-less bar, 2px gaps, tokened segments + text legend | custom flex `Box` (keep — color+text, a11y) |

### 7.3 Form controls (all currently uncontrolled — caller holds draft)

| Legacy | Classes / behavior | MUI mapping |
| --- | --- | --- |
| `textField` | `border border-border bg-bg rounded-button px-3 py-2` | `TextField size="small"` (outlined) |
| `searchField` | `type=search`, live filter, **focus preserved** across rerender | `TextField type="search"`; preserve focus via controlled value + stable key (RM-550) |
| `numberField` | `type=number tabular-nums`, `w-16/20/24`, `min` | `TextField type="number"` w/ `inputProps={{min}}` |
| `selectField` | native `<select>`, applies on change (or read-at-click on detail page) | `Select`/`TextField select`; preserve "value applies only on action button" on detail (RM-020 §5.6) |
| textarea (du3a) | `quran-text min-h-32 rounded-button`, `du3aTouched` guard | `TextField multiline`; keep touched-guard (RM-550) |
| range slider (reading) | `type=range accent-primary`, live-apply | `Slider min=1 max=5 step=1` (or keep native inside retained control) |
| checkbox (member/surah pickers) | `accent-primary` | `Checkbox color="primary"` |
| date input (backfill/edit) | native `type=date` | `TextField type="date"` (RTL-aware) |
| `stepper` (±value suffix) | `roundButton` − / value / + | `ButtonGroup`/custom w/ `IconButton`; Arabic-digit value |
| `labelled` wrapper | label `text-muted` + control | `FormControl` + `FormLabel`/`InputLabel` |

### 7.4 Navigation & chrome (RM-310)

| Legacy | Behavior | MUI mapping |
| --- | --- | --- |
| `renderTabBar` | bottom bar (mobile) ⇄ right rail (lg, RTL); native `<a href="#/…">`, `aria-current` | mobile `BottomNavigation` (fixed) + desktop `Drawer variant="permanent" anchor="right"` / rail `List`; keep hash `<a>` semantics + active state |
| tab icon | `.icon-mask` span, `currentColor`, PNG-over-SVG probe | **retain** `.icon-mask` mechanism (RM-330, §8) — MUI just hosts the span |
| `settingsControl` | native `<details>` popover + slider + sample | `Accordion`/`Popover` or keep `<details>`; preserve persisted open state |
| reader chrome | `sticky top-0 backdrop-blur bg-bg/95 -mx-4` | `AppBar position="sticky"` / `Box` w/ `alpha(bg,0.95)` + `backdropFilter` |

---

## 8. Retained CSS (AD-09 — keep, do **not** MUI-ify)

Ship via `<GlobalStyles>` or a kept stylesheet; these are app-specific and
correct as-is. Everything in [`theme.css`](src/theme/theme.css) **except** the
`@theme` block (which migrates into `createTheme`):

- ☐ `@font-face` Amiri Quran (local woff2, `font-display: swap`).
- ☐ Reading-scale variables (`:root` + `html[data-reading-scale='1..5']`) and
  `.quran-text` (font, `calc(1.6rem * var(--reading-scale))`, `line-height: 2.5`,
  justify + last-center). §3.3.
- ☐ `.icon-mask` (currentColor mask paint; alpha-only tinting). §7.4, RM-330.
- ☐ `.tab-bar` `env(safe-area-inset-bottom)` + the `min-width: 1024px` reset.
- ☐ Base `body` bg/ink + `html` font-family (redundant once MUI `CssBaseline` +
  theme apply them — reconcile in RM-210 to avoid double rules).

> Until RM-620 removes Tailwind, `@import 'tailwindcss'` and the `@theme` block
> stay for the still-legacy screen; the MUI preview lives beside it (RM-200
> isolation). Remove the `@theme` duplication only at RM-620.

---

## 9. Decisions & risks (feed OD-03 / RM-210)

| # | Item | Recommendation |
| --- | --- | --- |
| R1 | **Two palettes during transition** — `@theme` (Tailwind) and MUI theme both hold the hex until RM-620. | Treat `theme.css` `@theme` as the source; mirror into `createTheme`; add a code comment cross-linking both. Delete `@theme` at RM-620. |
| R2 | `--color-primary-strong` (#115e59) is **dead** (0 refs, tree-shaken). | Revive as `primary.dark` (natural hover/press) rather than dropping — MUI needs a dark variant anyway. |
| R3 | `--color-warn` and `--color-accent` are the **same** `#b45309`. Yellow warnings and the chart "pending" segment are indistinguishable. | Parity = keep identical. If OD-03 allows a Material refresh, split them (e.g. warning amber vs pending orange) and record it as an intentional delta. |
| R4 | **Tajawal not bundled** → UI is effectively `system-ui` today. | RM-210 decides: self-host Tajawal (`@font-face`) to honor design intent, **or** drop it. No Google Fonts `<link>` (zero-third-party-runtime rule). |
| R5 | Alpha tints via `color-mix` (`/10`,`/20`,`/95`). | Use `alpha(palette.X.main, n)`; verify color-mix vs alpha render equivalently. |
| R6 | Spacing unit (4px) ≠ MUI default (8px); breakpoints differ. | Set `spacing: 4` and override `breakpoints.values` to Tailwind px (§5, §6) so numeric parity holds. |
| R7 | Senior-audience sizing (large touch targets `min-h-[3.5rem]`, big hero buttons, reading scale). | Preserve in MUI component defaults; RM-650 verifies. |
| R8 | Identity never color-alone (charts/chips pair color with text/number). | Keep in all MUI ports — accessibility requirement (RM-650). |

## 10. Acceptance mapping (RM-115)

Evidence required: "Token table covers colors, typography, radii, spacing,
breakpoints, component variants, and retained CSS."

| Required | Covered in |
| --- | --- |
| Colors | §2 (11 active + 1 dead → `palette`, tints, contrastText) |
| Typography | §3 (families + bundling status, type scale, weights, reading scale) |
| Radii | §4 (`shape` + card/pill overrides) |
| Spacing | §5 (unit reconciliation + layout landmarks) |
| Breakpoints | §6 (md/lg → `breakpoints.values`) |
| Component variants | §7 (buttons, surfaces, forms, nav/chrome) |
| Retained CSS | §8 (fonts, reading scale, icon mask, safe area) |

**Next:** RM-210 (central MUI RTL theme) consumes §2–§8 once the toolchain lands
(Codex RM-120/RM-130); RM-320/RM-330 build the components in §7.
