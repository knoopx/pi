---
name: workspace-docs
description: "Check workspace for problem specs and convention docs before writing code. Use when starting implementation tasks, fixing tests, or any code change to find format rules and constraints."
topic: Workspace Documentation
token_cost: 140
keywords:
  [
    implement,
    build,
    create,
    fix,
    task,
    exercise,
    feature,
    todo,
    spec,
    specification,
    requirements,
    instructions,
    bug,
    test,
    failing,
    review,
    refactor,
  ]
requires_tools: [read, find]
---

## When to use

Before writing code for a non-trivial task, check if the workspace has a problem specification or convention document.

## Rules

- These are cheap to read and often contain the exact format rules, edge cases, or constraints the tests assert
- Look for (in priority order): `.docs/instructions.md` and `.docs/instructions.append.md` (exercism-style problem specs)
- Also check: `AGENTS.md` / `CLAUDE.md` (agent-specific instructions at repo root)
- Also check: `README.md` in the current directory, `SPEC.md` / `SPECIFICATION.md`, and `docs/*.md`
- Use find to discover them (`*.md`, `.docs/*.md`, `AGENTS.md`) and read the relevant one
- Do this ONCE at the start of a task, not every turn
- If the spec disambiguates a failing test, that single read saves many debug iterations
- Skip for pure read-only questions — only invest the Read call when you are about to change code
- NEVER skip this step when about to write code — the spec often contains test constraints

## File locations

`.docs/instructions.md`, `.docs/instructions.append.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `SPEC.md`, `SPECIFICATION.md`, `docs/*.md`.

## Example

Before coding: `find(".docs/*.md")` → finds `instructions.md` → `read(".docs/instructions.md")` reveals test constraints like "output must be sorted". Saves multiple debug iterations.
