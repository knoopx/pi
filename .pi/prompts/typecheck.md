Run TypeScript type checking on all extensions in parallel and fix all reported issues:

```bash
ls -d agent/extensions/*/ | xargs -P $(nproc) -I{} sh -c '(cd "{}" && bunx tsc --noEmit 2>&1 || true)'
```

Review every error and warning reported by the type checker. Fix all issues across all extensions — do not leave any unaddressed. This includes:

- Type mismatches and missing type annotations
- Unused imports and variables
- Incorrect return types or parameter types
- Missing null/undefined checks
- Any other TypeScript compilation errors

After fixing, re-run the type check to confirm zero errors remain.
