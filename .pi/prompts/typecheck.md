Run TypeScript type checking on all extensions:

```bash
for dir in agent/extensions/*/; do
  echo "=== Type checking: $dir ==="
  (cd "$dir" && npx tsc --noEmit) 2>&1 || true
done
```
