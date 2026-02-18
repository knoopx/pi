---
description: Generate release notes from changes between branches or tags
---

Generate release notes from changes between branches or tags.

<input>
- Branch or tag range (e.g., `v1.2.0...v1.3.0`, `staging...develop`)
- Default: current working changes
</input>

<workflow>
1. **Get the commit log**:
   ```bash
   git log origin/<base>..origin/<target> --oneline
   ```

2. Get the diff stat to see scope:

   ```bash
   git diff origin/<base>..origin/<target> --stat
   ```

3. Group commits by type (features, fixes, breaking changes, other)

4. For unclear commits, check the actual diff:

   ```bash
   git diff origin/<base>..origin/<target> -- <relevant-paths>
   ```

5. Write release notes following the structure below
   </workflow>

<rules>
**Content**
- Breaking changes go first with migration guidance
- New features explain the capability gained
- Fixes describe what was broken and is now working
- Include all changes (CI, refactors, tests, tooling)

**Language**

- Clear, concise descriptions
- Present tense ("Adds", "Fixes", not "Added", "Fixed")
- No commit hashes or PR numbers unless requested
- Technical terms OK (endpoints, modules, etc.)
  </rules>

<output-format>
## Breaking Changes
- Description of breaking change and how to migrate

## New Features

- Feature description and what it enables

## Fixes

- What was broken and is now working

## Other

- Everything else (CI, refactors, tests, tooling, dependencies)

(Omit empty sections)
</output-format>

<examples>
**Bad** (too vague):
"- Fixed bugs
- Improved performance"

**Good**:
"## Breaking Changes

- STT endpoints now return upstream provider response directly instead of normalized format.

## New Features

- Cognigy voice gateway bridge supports TTS streaming over WebSocket.

## Fixes

- Cognigy bridge routes to provider endpoints instead of looping back through gateway.

## Other

- CI workflow split into parallel jobs.
- Catalog loader reverted from extends system to self-contained files.
- Hathora-deployed models removed pending migration."
  </examples>
