# React Migration Documentation Router

The former plan/tracker/session-log monolith was compacted after RM-330 to keep
fresh Codex and Claude sessions from loading historical context by default.

Start with [`docs/react-migration/NOW.md`](docs/react-migration/NOW.md). It names
the active task and the exact additional sections to read.

| Need                                                    | Document                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| Current handoff and next read set                       | [`NOW.md`](docs/react-migration/NOW.md)                       |
| Task statuses and dependencies                          | [`TRACKER.md`](docs/react-migration/TRACKER.md)               |
| Stable rules, architecture, decisions, risks, and gates | [`PLAN.md`](docs/react-migration/PLAN.md)                     |
| Task-specific scope and verification                    | [`tasks/`](docs/react-migration/tasks/)                       |
| Pre-compaction history                                  | [`archive/README.md`](docs/react-migration/archive/README.md) |

Do not load every migration document. For a normal task, read `NOW.md`, the one
active task record, the relevant tracker phase, and only the explicitly linked
reference sections.

The full original plan and session log through RM-330 remain immutable in Git at
commit `382ff6c` under this same path.
