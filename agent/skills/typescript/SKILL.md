---
name: typescript
description: Configures TypeScript projects, defines types and interfaces, writes generics, and implements type guards. Use when setting up tsconfig.json, creating type definitions, or ensuring type safety in JS/TS codebases.
---

References are relative to /home/knoopx/.pi/agent/skills/typescript.

# TypeScript

Type-safe JavaScript with static typing and modern features.

## Quick Start

```bash
# Initialize project
bun init --typescript

# Type check
bunx tsc --noEmit

# Run tests
vitest run
```

## Configuration

### tsconfig.json (Strict)

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

## Type Definitions

### Basic Types

```typescript
let str: string = "hello";
let num: number = 42;
let bool: boolean = true;
let arr: number[] = [1, 2, 3];
let tuple: [string, number] = ["age", 25];
let obj: { name: string; age: number } = { name: "John", age: 30 };
```

### Interfaces vs Types

```typescript
// Interface for object shapes
interface User {
  id: number;
  name: string;
  email: string;
}

// Type for function signatures
type CreateUser = (data: Partial<User>) => Promise<User>;

// Discriminated union (branded types)
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
```

## Functions

### Function Declaration

```typescript
function add(a: number, b: number): number {
  return a + b;
}

// Arrow function
const add = (a: number, b: number): number => a + b;

// Optional parameters
function greet(name: string, title?: string): string {
  return title ? `${title} ${name}` : name;
}

// Rest parameters
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// Function overloads
function format(input: string): string;
function format(input: number): string;
function format(input: string | number): string {
  return String(input);
}
```

## Classes

```typescript
class Person {
  name: string;
  private age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  greet(): string {
    return `Hello, ${this.name}`;
  }
}

// Inheritance
class Employee extends Person {
  role: string;

  constructor(name: string, age: number, role: string) {
    super(name, age);
    this.role = role;
  }
}
```

## Generics

```typescript
// Generic function
function wrap<T>(value: T): { value: T } {
  return { value };
}

// Generic class
class Container<T> {
  constructor(private value: T) {}

  get(): T {
    return this.value;
  }
}

// Generic constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## Type Guards

```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function process(value: unknown) {
  if (isString(value)) {
    console.log(value.toUpperCase()); // value is string here
  }
}
```

## Error Handling

### Custom Errors

```typescript
class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
```

### Result Type

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

## Best Practices

- Use `strict: true` in tsconfig
- Avoid `any` - use `unknown` or specific types
- Prefer interfaces for object shapes
- Use branded types for primitives needing validation
- Make invalid states unrepresentable
- Type at boundaries (API inputs/outputs)

## Compilation

```bash
tsc                    # Compile
tsc --noEmit          # Type check only
tsc --project tsconfig.json  # Specific config

# Watch mode (use tmux for background)
tmux new -d -s tsc 'tsc --watch'
```

## Tips

- `tsc --noEmit` for fast type checking
- Gradual adoption with `allowJs: true`
- Path mapping for clean imports: `"@/*": ["src/*"]`
- Declaration files: `"declaration": true`
- Source maps: `"sourceMap": true`

## Related Skills

- **vitest**: Test utilities and mocking
- **bun**: Package management and scripting
- **ast-grep**: Pattern matching for refactoring
