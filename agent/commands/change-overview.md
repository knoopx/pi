---
description: Generate a management-level overview of changes for team communication
args:
  from:
    default: main
    description: Starting revision
  to:
    default: "@"
    description: Ending revision
---

Generate a high-level overview of changes suitable for sharing with teammates and management.

## Changes

```
!{jj log -r "$from::$to" --no-graph -T 'description.first_line() ++ "\n"' 2>/dev/null}
```

## Stats

```
!{jj diff -r "$from::$to" --stat 2>/dev/null}
```

## Instructions

1. Summarize the changes in 2-3 sentences for a non-technical audience
2. Group by theme (features, fixes, infrastructure)
3. Highlight any breaking changes or user-facing impacts
4. Keep it concise - this is for status updates, not release notes
