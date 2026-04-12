Run ESLint on all extensions and collect outputs:

```bash
for dir in agent/extensions/*/; do
  echo "=== Linting: $dir ==="
  (cd "$dir" && bun lint) 2>&1 || true
done
```
