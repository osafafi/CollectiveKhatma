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

Update this doc when dataset shape, loader, symbols, reader rendering, or scope mapping changes.
