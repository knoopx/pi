---
name: conventional-commits
description: "Writes and reviews Conventional Commits commit messages (v1.0.0) to support semantic versioning and automated changelogs. Use when drafting git commit messages, PR titles, release notes, or when enforcing a conventional commit format (type(scope): subject, BREAKING CHANGE, footers, revert)."
---

# Conventional Commits (v1.0.0)

Produce consistent commit messages that parse into changelogs and drive semantic versioning.

## Format

```
type(scope): description

[optional body]

[optional footers]
```

Rules: header on one line, scope is always included, separate sections with blank lines. Add `!` before `:` for breaking changes (e.g., `feat(api)!: remove v1`).

## Choosing the Type

**User-facing changes:**

- `feat`: new user-visible behavior — new CLI flags, UI components, API endpoints
- `fix`: corrected behavior — fixes crashes, handles edge cases, corrects output

**Maintenance:**

- `refactor`: structure change without behavior change — renaming, extracting utilities
- `perf`: performance improvement — faster algorithms, reduced allocations
- `chore`: general maintenance — dead code removal, tooling updates
- `style`: formatting only — whitespace, semicolons, no logic changes
- `test`: test-only changes — `.test.ts`, `.spec.ts` files
- `build`: build system — package.json, Cargo.toml, bundler config
- `ci`: CI/CD pipelines — GitHub Actions, deployment scripts
- `docs`: documentation files only — `.md`, `.txt`. Code comments use the type matching the actual code change.

**Reverts:**

- `revert`: undo a previous commit — `revert: <original-message>`

When unsure: new user behavior → `feat`, corrected behavior → `fix`, otherwise → `chore` or a more specific maintenance type.

## Writing the Description

Use imperative mood, be specific, avoid generic words like "stuff" or "changes".

```
✅ feat(auth): add passwordless login
✅ fix(api): handle empty pagination cursor
❌ docs(agent): add behavioral guidelines and core principles  (too vague)
✅ docs(agent): add rules for dead code removal, build verification, security  (specific)
```

## Breaking Changes

Mark in the header with `!`:

```
feat(api)!: remove deprecated v1 endpoints
```

Or add a `BREAKING CHANGE:` footer when you need an explanation:

```
feat(api): remove deprecated v1 endpoints

BREAKING CHANGE: /v1/* endpoints are removed; migrate to /v2/*.
```

## Semantic Versioning Mapping

- `fix` → patch
- `feat` → minor
- Any breaking change (`!` or `BREAKING CHANGE:`) → major

## When Asked to Write a Commit Message

Collect what changed, the scope/module, whether it's user-facing, and any issue IDs. Then produce a conventional header with optional body and footers.
