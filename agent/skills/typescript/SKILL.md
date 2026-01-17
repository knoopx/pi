name: typescript
description: |
  Follow best practices for TypeScript development, including type safety, modern patterns, testing, and project organization.

  Use this to:
  - Write strictly typed TypeScript code
  - Organize projects with clear type definitions
  - Implement modern TypeScript patterns and generics
  - Ensure type safety in testing and error handling
---

This skill provides templates and workflows for modern TypeScript development focused on type safety, code organization, and maintainability.

## Core Principles

- **Maximum Strictness**: Enable all strict compiler flags to catch errors early
- **Type Safety**: Avoid `any`. Use `unknown` or branded types where appropriate
- **Modern ESM**: Target `ESNext` and use ESM modules exclusively
- **Self-Documenting Code**: Types serve as inline documentation
- **Fail Fast**: Validate inputs at boundaries, catch errors at compile time

## TypeScript Configuration

### tsconfig.json - Strict Mode

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ESNext"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### tsconfig.json for Bun

If using Bun runtime, include `bun-types`:

```json
{
  "compilerOptions": {
    "types": ["bun-types"],
    "lib": ["ESNext"],
    "target": "ESNext"
  }
}
```

## Project Structure

```
my-project/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── types/
│   │   ├── index.ts            # Type exports
│   │   └── domain.ts           # Domain types
│   ├── utils/
│   │   ├── index.ts
│   │   ├── validators.ts
│   │   └── formatters.ts
│   └── services/
│       ├── index.ts
│       └── api.ts
├── tests/
│   ├── unit/
│   │   ├── utils.test.ts
│   │   └── validators.test.ts
│   ├── integration/
│   │   └── api.test.ts
│   └── fixtures/
│       └── test-data.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts            # or bun test config
└── README.md
```

## Type Definitions

### Strict Typing for Functions

```typescript
/**
 * Add two numbers together.
 * @param a First number
 * @param b Second number
 * @returns The sum
 */
function add(a: number, b: number): number {
  return a + b;
}

// Function with optional parameter
function greet(name: string, title?: string): string {
  return title ? `${title} ${name}` : `Hello, ${name}`;
}

// Function with rest parameters
function sum(...numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

// Function with object parameter
interface User {
  id: number;
  name: string;
  email: string;
}

function createUser(data: User): void {
  console.log(`User ${data.name} created`);
}
```

### Strict Typing for Objects

```typescript
// Interface for strict object shape
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
  readonly retries?: number;
}

// Using const assertion for literal types
const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  retries: 3,
} as const;

// Readonly properties
interface ImmutableUser {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

// Index signatures with constraints
interface StringMap {
  [key: string]: string | number;
}

// Mapped types for transformations
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P];
};
```

### Union and Literal Types

```typescript
// Discriminated unions for type safety
type ApiResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: string };

// Literal types for strict values
type Environment = "development" | "staging" | "production";
type LogLevel = "debug" | "info" | "warn" | "error";

// Type guards
function isSuccess<T>(
  response: ApiResponse<T>,
): response is { status: "success"; data: T } {
  return response.status === "success";
}

// Usage
const response: ApiResponse<User> = { status: "success", data: user };
if (isSuccess(response)) {
  console.log(response.data);
}
```

### Generics

```typescript
// Generic function with constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic class
class Container<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }

  setValue(value: T): void {
    this.value = value;
  }
}

// Generic with default type
interface Result<T = void> {
  ok: boolean;
  value?: T;
  error?: Error;
}

// Generic with multiple constraints
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

### Branded Types for Runtime Safety

```typescript
// Create distinct types even if underlying is primitive
type UserId = string & { readonly __brand: "UserId" };
type Email = string & { readonly __brand: "Email" };

// Helper functions to create branded types
function createUserId(id: string): UserId {
  if (!id) throw new Error("Invalid user ID");
  return id as UserId;
}

function createEmail(email: string): Email {
  if (!email.includes("@")) throw new Error("Invalid email");
  return email as Email;
}

// Usage - compiler prevents mixing up types
function getUserById(id: UserId): User | null {
  // Can't accidentally pass Email here
}

const userId = createUserId("user-123");
const email = createEmail("user@example.com");

getUserById(userId); // ✅ OK
getUserById(email); // ❌ Type error
```

### Utility Types

```typescript
// Partial - make all properties optional
type PartialUser = Partial<User>;

// Required - make all properties required
type RequiredUser = Required<User>;

// Readonly - make all properties readonly
type ReadonlyUser = Readonly<User>;

// Pick - select specific properties
type UserPreview = Pick<User, "id" | "name">;

// Omit - exclude specific properties
type UserWithoutId = Omit<User, "id">;

// Record - map properties to type
type StatusMap = Record<"pending" | "done" | "failed", number>;

// Exclude/Extract - filter union types
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;

// ReturnType - extract function return type
type AddReturn = ReturnType<typeof add>;

// InstanceType - extract class instance type
class MyClass {}
type MyInstance = InstanceType<typeof MyClass>;
```

## Common Patterns

### Error Handling with Types

```typescript
// Custom error types
class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// Result type for explicit error handling
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Helper function
function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

// Usage
function parseJson(json: string): Result<unknown, SyntaxError> {
  try {
    return ok(JSON.parse(json));
  } catch (e) {
    return err(e as SyntaxError);
  }
}

const result = parseJson(someString);
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

### Module Augmentation

```typescript
// Extend types from third-party libraries
declare module "some-library" {
  interface SomeType {
    customProperty: string;
  }
}

// Extend global types
declare global {
  interface Window {
    myCustomApi: {
      doSomething(): Promise<void>;
    };
  }
}
```

### Conditional Types

```typescript
// Type that depends on another type
type IsString<T> = T extends string ? true : false;

type A = IsString<"hello">; // true
type B = IsString<number>; // false

// More practical example
type Flatten<T> = T extends Array<infer U> ? U : T;

type Str = Flatten<string[]>; // string
type Num = Flatten<number>; // number

// Extract array element type
type ElementOf<T> = T extends (infer E)[] ? E : never;
```

## Best Practices

### 1. Avoid `any`

```typescript
// ❌ Bad - lose all type information
function processData(data: any): any {
  return data.someProperty;
}

// ✅ Good - use unknown for uncertain types
function processData(data: unknown): void {
  if (typeof data === "string") {
    console.log(data.toUpperCase());
  }
}

// ✅ Better - use generics
function processData<T>(data: T): T {
  return data;
}
```

### 2. Make Invalid States Unrepresentable

```typescript
// ❌ Bad - allows invalid combinations
interface PageState {
  isLoading: boolean;
  data?: User;
  error?: string;
}

// ✅ Good - types prevent invalid states
type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User }
  | { status: "error"; error: string };
```

### 3. Type at Boundaries

```typescript
// Define types at API boundaries
interface ApiUser {
  id: string;
  name: string;
  email: string;
}

// Convert to domain types
interface DomainUser {
  id: UserId;
  name: string;
  email: Email;
}

function convertApiUser(apiUser: ApiUser): DomainUser {
  return {
    id: createUserId(apiUser.id),
    name: apiUser.name,
    email: createEmail(apiUser.email),
  };
}
```

### 4. Use Constants for String Literals

```typescript
// ❌ Bad - magic strings scattered
function log(level: string) {
  if (level === "debug") {
  }
}

// ✅ Good - centralized constants with types
const LogLevels = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

type LogLevel = (typeof LogLevels)[keyof typeof LogLevels];

function log(level: LogLevel) {
  // Autocomplete and type checking
}
```

### 5. Document with JSDoc

````typescript
/**
 * Validates an email address.
 *
 * @param email - The email to validate
 * @returns true if email is valid, false otherwise
 *
 * @example
 * ```ts
 * isValidEmail("user@example.com") // true
 * isValidEmail("invalid") // false
 * ```
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
````

## Testing TypeScript Code

### Unit Tests with Vitest

```typescript
import { describe, it, expect } from "vitest";
import { add, greet } from "./math";

describe("math utilities", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });

  it("greets with optional title", () => {
    expect(greet("Alice")).toBe("Hello, Alice");
    expect(greet("Bob", "Mr")).toBe("Mr Bob");
  });
});
```

### Type Testing

```typescript
import { expectType, expectAssignable } from "vitest";

// Verify function has correct type
expectType<(a: number, b: number) => number>(add);

// Verify type assignability
interface User {
  id: number;
  name: string;
}

const user = { id: 1, name: "Alice", extra: "prop" };
expectAssignable<User>(user);
```

## Migrating to TypeScript

### Gradual Adoption

1. Enable TypeScript compilation without strict checks
2. Gradually enable strict flags one by one
3. Fix type errors systematically
4. Use `allowJs` to mix JS and TS during transition

### Configuration for Gradual Migration

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false
  }
}
```

## Common Gotchas

### Type Narrowing

```typescript
// ❌ Doesn't narrow properly
if (typeof x === "string" || typeof x === "number") {
  // Can still be either type here
}

// ✅ Proper narrowing
if (typeof x === "string") {
  // x is string
} else if (typeof x === "number") {
  // x is number
}
```

### Object Mutability

```typescript
// Be explicit about mutability
interface MutableConfig {
  timeout: number;
  retries: number;
}

interface ImmutableConfig {
  readonly timeout: number;
  readonly retries: number;
}
```

### This Binding

```typescript
// ❌ Can lose `this` context
const handler = user.handleClick;
document.addEventListener("click", handler);

// ✅ Preserve `this` with arrow function
document.addEventListener("click", () => user.handleClick());

// ✅ Or bind explicitly
document.addEventListener("click", user.handleClick.bind(user));
```

## Performance Considerations

1. **Keep Types Simple**: Complex type operations can slow compilation
2. **Use `noEmit`**: When only doing type checking, skip emitting JavaScript
3. **Incremental Mode**: Use `incremental: true` for faster rebuilds
4. **Type Checking**: In CI, use `tsc --noEmit` for fast type checking
5. **Declaration Files**: Build declaration files once, reuse across monorepo

## Related Skills

- **bun**: Use Bun as a fast runtime for executing TypeScript code without compilation, or manage TypeScript projects with Bun's tooling.
- **vitest**: Write and run tests for TypeScript code with Vitest, ensuring type safety in your test suites.
- **knip**: Identify and remove unused dependencies, files, and exports in TypeScript projects.
- **ast-grep**: Find complex code patterns and perform safe structural transformations in TypeScript codebases.
- **jscpd**: Detect and analyze duplicate code in TypeScript projects.

## Related Tools

- **lsp**: Query language server for definitions, references, types, symbols, diagnostics, rename, and code actions.
- **generate-codemap**: Generate a compact map of the codebase structure, symbols, and dependencies.
- **analyze-dependencies**: Analyze dependency tree for files or show external packages used in the project.
