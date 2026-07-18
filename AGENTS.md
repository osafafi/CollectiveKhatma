# Ranqur agent map

Read this file first. Then read only the matching brick docs. Do not load every doc.

For feature, fix, or refactor work, use `$ship-ranqur-change` from
`.agents/skills/ship-ranqur-change/SKILL.md`.

## Find the brick

| User says                                               | Read                         | Start code                            |
| ------------------------------------------------------- | ---------------------------- | ------------------------------------- |
| person, roster, name, pause, avatar                     | `docs/areas/people.md`       | `src/app/admin/pages/RosterPage.tsx`  |
| khatma, series, create, scope, image, reciter           | `docs/areas/khatmas.md`      | `src/app/admin/pages/KhatmasPage.tsx` |
| assign, distribute, round, warning, release, rollover   | `docs/areas/distribution.md` | `src/domain/distribution.ts`          |
| member, my pages, finish, completion, history           | `docs/areas/member-app.md`   | `src/app/member/MemberApp.tsx`        |
| admin, dashboard, form, manage                          | `docs/areas/admin-app.md`    | `src/app/admin/AdminApp.tsx`          |
| reader, Quran page, surah, mushaf data                  | `docs/areas/quran-data.md`   | `src/app/member/reader/`              |
| button, card, chart, theme, RTL, icon, global copy rule | `docs/areas/shared-ui.md`    | `src/components/`                     |
| Firebase, schema, test, build, deploy, CI               | `docs/areas/operations.md`   | `src/data/` or `package.json`         |

If change hits two rows, read two docs. No more unless imports lead there.

## Hard walls

- `domain` thinks. Pure. No React. No Firebase.
- `data` talks Firebase.
- `app/store` reads live data.
- `app/operations` is the UI write door.
- Feature UI never imports `data`.
- Shared `components` never import `app` or `data`.
- Arabic UI words live in `src/content/strings.ar.ts`.
- No live Firebase write or deploy without user saying yes.

## Work loop

1. Turn messy ask into brick names.
2. Trace callers, writes, data, rules, and tests.
3. State scope: code files, tests, docs. Check dirty work. Own only your files.
4. Plan. Change. Add or update tests.
5. Run focused tests. Then run `npm run check`.
6. Review diff. Update each hit brick doc.
7. Chat ends caveman-short:

```text
Did: thing done
Hit: bricks changed
Tests: pass / not run + why
Docs: files changed
Risk: none / short warning
```

Temporary plans belong in the task, not the repo. Docs hold current truth only.
