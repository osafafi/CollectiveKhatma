# React Migration Documentation

This directory is the context-efficient control center for the React migration.
The documents are deliberately separated by how often an agent needs them.

## Reading order

For a normal task session:

1. Read [`NOW.md`](NOW.md).
2. Read only the task record named by `NOW.md`.
3. Consult the relevant phase in [`TRACKER.md`](TRACKER.md) for status and
   dependencies.
4. Read only the sections of [`PLAN.md`](PLAN.md) or the root reference audits
   named by the task record.

Do not read every migration document or the historical archive by default.
A routine task startup should consume no more than about 5,000–8,000 tokens of
migration documentation.

## Document ownership

| Document                   | Purpose                                                      | Update pattern                                       |
| -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| [`NOW.md`](NOW.md)         | Current phase, latest handoff, next task, exact read set     | Rewrite at every claim/handoff; never append history |
| [`TRACKER.md`](TRACKER.md) | Canonical task owner/status/dependencies/acceptance          | Update only affected rows                            |
| [`PLAN.md`](PLAN.md)       | Stable governance, architecture, decisions, risks, and gates | Update only when a rule or decision changes          |
| [`tasks/`](tasks/)         | Detailed scope and evidence for one task                     | Read/update only the active task                     |
| [`archive/`](archive/)     | Historical lookup instructions                               | Never part of routine startup                        |

The route, theme, and dependency audits remain at the repository root because
they are useful reference artifacts. They are opt-in and should be opened by
heading or line range rather than loaded wholesale.
