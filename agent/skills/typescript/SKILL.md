---
name: typescript
description: "Configures TypeScript projects, defines types and interfaces, writes generics, and implements type guards. Use when setting up tsconfig.json, creating type definitions, or ensuring type safety in JS/TS codebases."
---

# TypeScript

Type-safe JavaScript development with bun and vitest in this project.

## Quick Start

```bash
bun init --typescript    # Initialize project
bunx tsc --noEmit        # Type check
vitest run               # Run tests
```

## Project Configuration

This project uses bun with ESNext targets. Reference config in `templates/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ESNext"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

## Decision Guide: Interfaces vs Types

Use this when choosing between `interface` and `type`:

- **Interface** when: defining object shapes that may be extended, or when declaration merging is needed (e.g., augmenting third-party types)
- **Type** when: defining unions, intersections, mapped types, conditional types, or function signatures

```typescript
// Interface — extendable object shape
interface User {
  id: number;
  name: string;
  email: string;
}

// Type — unions and computed types
type Status = "loading" | "success" | "error";
type CreateUser = (data: Partial<User>) => Promise<User>;

// Discriminated union — use type, not interface
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
```

## Type Safety Patterns

### Branded Types for Domain Primitives

Use branded types when a plain `string` or `number` could be confused across domains:

```typescript
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function createUserId(id: string): UserId {
  // validate format here
  return id as UserId;
}

// Compiler prevents: getUser(orderId) — type mismatch
function getUser(id: UserId): Promise<User> { /* ... */ }
```

### Making Invalid States Unrepresentable

Model states as discriminated unions so illegal combinations are compile errors:

```typescript
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// Impossible to have data without status: "success"
function render(state: AsyncState<User[]>) {
  switch (state.status) {
    case "success": return renderTable(state.data);
    case "error": return renderError(state.error);
    // exhaustiveness: TS errors if a case is missing
  }
}
```

### Type Guards with Runtime Validation

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}
```

### Result Type for Error Handling

Prefer `Result<T>` over try/catch for composable error handling:

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function safeParse(json: string): Result<unknown> {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
```

## Workflow

1. **Set up project**: `bun init --typescript`, copy `templates/tsconfig.json`
2. **Write types first**: Define interfaces/types at module boundaries before implementation
3. **Type check**: `bunx tsc --noEmit` — fix errors before proceeding
4. **Watch mode**: `tmux new -d -s tsc 'tsc --watch'` for continuous feedback
5. **Test**: `vitest run` to validate behavior matches types
6. **Gradual adoption**: Use `allowJs: true` + `checkJs: true` when migrating JS files incrementally

## Constraints

- Always use `strict: true` — never weaken strictness per-file with `// @ts-ignore`; use `// @ts-expect-error` with a comment explaining why
- Avoid `any` — use `unknown` and narrow with type guards
- Type at boundaries (API inputs/outputs, function signatures) — let inference handle internals
- Path aliases: use `@/*` mapped to `src/*` for imports
