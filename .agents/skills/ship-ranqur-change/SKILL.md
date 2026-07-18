---
name: ship-ranqur-change
description: Scope, implement, review, test, and document Ranqur repository changes. Use for feature work, bug fixes, refactors, schema changes, UI changes, or any request that needs code edits in this repo and must end with a caveman-style delivery summary.
---

# Ship Ranqur Change

Use `AGENTS.md` as the map. Keep context small. Make scope exact.

## Workflow

1. Read `AGENTS.md`.
2. Translate the request into one or more brick rows.
3. Read only those `docs/areas/*.md` files.
4. Trace start code through imports, callers, operation, data, domain, rules, and tests.
5. Check `git status`. Preserve unrelated work. If agents work together, state owned paths.
6. Plan exact code, tests, and docs. Avoid nearby cleanup outside that scope.
7. Implement through the repo walls in `AGENTS.md`.
8. Add or update the smallest tests that prove behavior.
9. Run focused tests. Then run `npm run check`.
10. Review `git diff`, broken links, scope creep, and missing docs.
11. Update every impacted brick doc with current truth only.
12. Return the exact caveman block from `AGENTS.md`.

## Scope test

Before coding, answer:

- What user behavior changes?
- What owns that behavior now?
- What reads it?
- What writes it?
- What pure rule decides it?
- What persistence or schema can break?
- What tests prove it?
- What brick docs become false?

If an answer is unknown, inspect. Do not guess. Stop expanding when all answers are covered.

Touching a shared file does not automatically hit that shared brick. Example: changing one feature label in `strings.ar.ts` updates the feature doc, not Shared UI. Update a brick doc only when its behavior, flow, ownership, or hard rules change.

## Review test

Reject the diff if it:

- imports Firebase outside `src/data`;
- imports `data` from feature UI;
- puts business rules in TSX;
- puts app state inside shared UI;
- resets local drafts or reader position on live snapshots;
- exposes warning state to other members;
- changes schema without rules and data tests;
- leaves hit docs stale;
- reports tests as passed when they were not run.
