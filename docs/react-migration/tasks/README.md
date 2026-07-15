# Migration Task Records

Each active or newly completed task owns one record named `RM-xxx.md`. Agents
read only the current task record. Completed records are evidence, not default
startup material.

Use this shape:

```markdown
# RM-xxx — Task title

Status, owner, dependencies, baseline commit, and final commit.

## Outcome / scope

## Acceptance criteria

## Context to read

## Files or ownership boundaries

## Decisions and risks

## Verification

## Final handoff
```

Rules:

- Keep scope and acceptance criteria concise.
- Link exact headings in large reference documents.
- Put detailed verification here, not in the tracker.
- Update the existing record across claim and completion; do not add separate
  session-log entries.
- Prefer commit hashes and paths over retelling old implementation narratives.
