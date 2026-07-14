# React Migration Historical Archive

Historical task narratives and the append-only session log were removed from
the working documentation after RM-330 to prevent routine context growth.

The immutable full snapshot is already stored and pushed in Git:

- Commit: `382ff6c`
- Path at that commit: `REACT_MIGRATION_PLAN.md`
- Coverage: migration planning through RM-330 completion, including every
  original tracker narrative, decision, review note, and session-log entry.

Retrieve it only when investigating history:

```bash
git show 382ff6c:REACT_MIGRATION_PLAN.md
```

Normal task sessions must not load that snapshot. Current state belongs in
[`../NOW.md`](../NOW.md), canonical statuses in [`../TRACKER.md`](../TRACKER.md),
stable rules in [`../PLAN.md`](../PLAN.md), and detailed new evidence in
[`../tasks/`](../tasks/).
