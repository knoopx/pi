---
description: Find and refactor duplicate code blocks
---

Find and refactor duplicate code in the project using `jscpd`.

**Target**: $1 (default: current directory)
**Options**: $@ (e.g., "--threshold 5" or "--min-tokens 100")

## 1. Scan

Run jscpd to detect copy-pasted code:

```bash
bunx jscpd --reporters console --ignore "**/node_modules/**,**/dist/**" $1 ${@:1}
```

## 2. Refactor

For each duplicate group found, apply one of these strategies:

**A. Extract to shared module** (identical functions across files):

- Create a new file in `src/utils/` or `src/lib/`
- Move the duplicated code there
- Update all imports in the original files

**B. Parameterize with generics** (similar functions with type differences):

- Consolidate into a single generic function
- Use type parameters to preserve type safety

**C. Extract configuration** (repeated config blocks):

- Move to a shared config file (e.g., `src/config/constants.ts`)
- Export and import where needed

**D. Use composition** (repeated patterns with variations):

- Extract the common logic into a higher-order function or hook
- Pass callbacks or configuration objects for variation

## 3. Verify

Re-run with a threshold to confirm duplication is within target:

```bash
bunx jscpd --threshold 5 --ignore "**/node_modules/**,**/dist/**" $1
```

If the command exits with code 0, duplication is below the threshold.
