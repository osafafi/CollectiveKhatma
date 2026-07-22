# Quran data brick

Owns: 604 mushaf pages, surah metadata, loader, symbols, reader rendering, scope maps.

Start files:

- Assets: `public/quran/`
- Load/render helpers: `src/content/quran/`
- Reader: `src/app/member/reader/`
- Admin scope maps: `src/app/admin/useSurahs.ts`, `useQuranScopeMaps.ts`
- Generator: `scripts/build-quran-data.ts`

Tests: `member-reader`, `domain/assignment`, Quran grid model and chart tests.

Hard rules:

- Assignment unit is mushaf page 1..604.
- App reads committed data. No runtime Quran API.
- Generator rewrites the dataset and needs network. Do not run casually.
- Keep text attribution and bundled Quran font license.
- Both mushaf readers place previous on the right and next on the left, with
  matching primary styles while enabled and muted styling only at a boundary.
- Assigned-reader navigation stacks chunk progress above the mushaf page number
  and uses the sticky bar's high-contrast text color.
- Assigned Quran text is preceded by a compact header with centered member
  identity, a left artwork-and-series stack, and a height-matched page-total tile
  at the right; the free-browse reader keeps its jump header.

Update this doc when dataset shape, loader, symbols, reader rendering, or scope mapping changes.
