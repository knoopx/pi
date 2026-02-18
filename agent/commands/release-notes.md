---
description: Generate release notes from changes between revisions
args:
  from:
    default: main
    description: Starting revision (tag or bookmark)
  to:
    default: "@"
    description: Ending revision
---

Generate release notes from changes between revisions.

## Commits

```
!{jj log -r "$from::$to" --no-graph -T 'description.first_line() ++ "\n"' 2>/dev/null}
```

## Stats

```
!{jj diff -r "$from::$to" --stat 2>/dev/null}
```

## Output Format

### Breaking Changes

- Description and migration steps

### New Features

- What it enables

### Fixes

- What was broken and is now working

### Other

- CI, refactors, tests, tooling

(Omit empty sections)

## Style

- Present tense ("Adds", "Fixes")
- Clear, concise descriptions
- No commit hashes unless requested
