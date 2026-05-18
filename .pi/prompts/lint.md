Run ESLint on all extensions and shared in parallel and parse results with jq:

```bash
(find agent/extensions -maxdepth 1 -mindepth 1 -type d && echo agent/shared) | \
  xargs -P 0 -I{} sh -c '(cd "{}" && bun lint --fix --format json --output-file /dev/stdout 2>/dev/null)' | \
  jq -r '.[] | .filePath as $fp | .messages[]? | "\($fp):\(.line):\(.column) \(.message)"'
```

Review every error and warning reported by the linter. Fix all issues across all extensions and shared — do not leave any unaddressed. This includes:

- Unused imports and variables
- Code style violations
- Potential bugs flagged by eslint rules
- Missing or incorrect annotations
- Any other linting errors or warnings

After fixing, re-run the linter to confirm zero issues remain.
