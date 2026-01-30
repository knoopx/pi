# TypeScript Reference

Detailed information about TypeScript features and patterns.

## Configuration

### tsconfig.json Options

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
  }
}
```

### Strict Mode Options

| Option                | Description                     |
| --------------------- | ------------------------------- |
| `strictNullChecks`    | Enforce strict null checks      |
| `strictFunctionTypes` | Strict function parameter types |
| `noImplicitAny`       | Disallow implicit any types     |
| `noImplicitThis`      | Disallow implicit any this      |
| `alwaysStrict`        | Apply all strict checks         |

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

### Advanced Types

```typescript
// Union
type Status = "loading" | "success" | "error";

// Intersection
type User = Person & { email: string };

// Generics
function identity<T>(arg: T): T {
  return arg;
}

// Utility types
type PartialUser = Partial<User>;
type ReadonlyUser = Readonly<User>;
type PickName = Pick<User, "name">;
type OmitEmail = Omit<User, "email">;
```

### Interfaces vs Types

```typescript
interface User {
  name: string;
  age: number;
}

type UserType = {
  name: string;
  age: number;
};

// Interface extends, type uses &
interface Admin extends User {
  role: string;
}
```

## Functions

### Function Declaration

```typescript
function add(a: number, b: number): number {
  return a + b;
}

// Async function
async function fetchData(url: string): Promise<unknown> {
  const response = await fetch(url);
  return response.json();
}

// Generator function
function* generateNumbers(limit: number): Generator<number> {
  for (let i = 1; i <= limit; i++) {
    yield i;
  }
}
```

### Arrow Function

```typescript
const add = (a: number, b: number): number => a + b;

// Curried function
const curriedAdd = (a: number) => (b: number) => a + b;

// Memoized function
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};
```

### Optional Parameters

```typescript
function greet(name: string, title?: string): string {
  return title ? `${title} ${name}` : name;
}

function createUser(options: {
  name: string;
  email?: string;
  age?: number;
}): User {
  // ...
}
```

### Rest Parameters

```typescript
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function log(...messages: string[]): void {
  console.log(messages.join(" "));
}

// Spread operator
const numbers = [1, 2, 3];
function addAll(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
addAll(...numbers); // [1, 2, 3]
```

### Function Overloads

```typescript
function format(input: string): string;
function format(input: number): string;
function format(input: string | number): string {
  return String(input);
}

// With type guards
function toNumber(input: unknown): number | string;
function toNumber(input: unknown): number | string {
  if (typeof input === "number") {
    return input;
  }
  if (!isNaN(Number(input))) {
    return Number(input);
  }
  return input;
}
```

## Classes

### Basic Class

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
```

### Class with Constructor

```typescript
class User {
  readonly id: string;
  name: string;
  email: string;

  constructor(data: { id: string; name: string; email: string }) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
  }
}
```

### Class with Getters/Setters

```typescript
class BankAccount {
  private _balance: number = 0;

  get balance(): number {
    return this._balance;
  }

  set balance(value: number) {
    if (value < 0) {
      throw new Error("Balance cannot be negative");
    }
    this._balance = value;
  }
}
```

### Class with Abstract Methods

```typescript
abstract class Shape {
  abstract area(): number;
  abstract perimeter(): number;

  describe(): string {
    return `Area: ${this.area()}, Perimeter: ${this.perimeter()}`;
  }
}

class Circle extends Shape {
  constructor(private radius: number) {
    super();
  }

  area(): number {
    return Math.PI * this.radius ** 2;
  }

  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }
}
```

### Class with Static Methods

```typescript
class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  log(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}
```

### Inheritance

```typescript
class Animal {
  constructor(private name: string) {
    this.name = name;
  }

  move(): void {
    console.log(`${this.name} is moving`);
  }
}

class Dog extends Animal {
  constructor(name: string) {
    super(name);
  }

  bark(): void {
    console.log(`${this.name} is barking`);
  }
}
```

## Generics

### Generic Function

```typescript
function wrap<T>(value: T): { value: T } {
  return { value };
}

function unwrap<T>(wrapped: { value: T }): T {
  return wrapped.value;
}
```

### Generic Class

```typescript
class Container<T> {
  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
  }
}
```

### Generic Interface

```typescript
interface Mapper<T, U> {
  map(input: T): U;
}

class StringToNumberMapper implements Mapper<string, number> {
  map(input: string): number {
    return Number(input);
  }
}
```

### Generic Constraints

```typescript
// Simple constraint
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Multiple constraints
function clone<T extends { clone(): T }>(obj: T): T {
  return obj.clone();
}

// Class constraint
class Logger<T extends { new (...args: any[]): T }> {
  static create<T>(cls: T): T {
    return new cls();
  }
}
```

### Utility Types

```typescript
// Partial<T>
type PartialUser = Partial<User>;
const admin: PartialUser = { name: "Admin" };

// Required<T>
type RequiredUser = Required<User>;

// Readonly<T>
type ReadonlyUser = Readonly<User>;

// Pick<T, K>
type UserName = Pick<User, "name">;

// Omit<T, K>
type UserWithoutEmail = Omit<User, "email">;

// Exclude<T, K>
type UserWithoutId = Exclude<User, "id">;
```

### Default Parameters with Generics

```typescript
function createContainer<T>(value: T = {} as T): Container<T> {
  return new Container(value);
}
```

## Type Guards

### Type Guard Functions

```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

### Using Type Guards

```typescript
function process(value: unknown) {
  if (isString(value)) {
    console.log(value.toUpperCase()); // TypeScript knows this is a string
  } else if (isNumber(value)) {
    console.log(value.toFixed(2));
  }
}
```

### Custom Type Guards

```typescript
interface User {
  id: string;
  name: string;
  email?: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.email === undefined || typeof value.email === "string")
  );
}
```

### Type Guard with Discriminated Unions

```typescript
type Request =
  | { type: "login"; email: string; password: string }
  | { type: "signup"; email: string; password: string; name: string };

function isLoginRequest(
  value: Request,
): value is { type: "login"; email: string; password: string } {
  return value.type === "login";
}

function handleRequest(request: Request) {
  if (isLoginRequest(request)) {
    // TypeScript knows this is a login request
    console.log(`Logging in with ${request.email}`);
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

class NotFoundError extends Error {
  constructor(
    public resource: string,
    public id: string,
  ) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

class AuthenticationError extends Error {
  constructor(message: string = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
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

function parseConfig(): Result<Config> {
  const result = safeParse("...");
  if (result.ok) {
    return result;
  }
  return { ok: false, error: new ConfigError("Invalid config") };
}
```

### Optional Chaining

```typescript
function getUserEmail(user?: User): string | undefined {
  return user?.email;
}

function getUserName(user?: User): string | null {
  return user?.name ?? null;
}
```

## Best Practices

### Type Hints

- All function parameters and return values
- Use `unknown` instead of `any`
- Type at boundaries (API inputs/outputs)
- Use branded types for primitives needing validation

### Interfaces vs Types

- Prefer interfaces for object shapes
- Use types for unions and primitives
- Types can be extended, interfaces cannot

### Type Guards

- Make functions pure when possible
- Return early for edge cases
- Fail fast and loud
- Include context in error messages

### Avoid

- `any` - use `unknown` or specific types
- Implicit any - use `strict: true`
- Complex type assertions - refactor instead

## Compilation

### Compilation Options

```bash
# Compile all files
tsc

# Type check only
tsc --noEmit

# Specific config file
tsc --project tsconfig.json

# Watch mode
tsc --watch

# Incremental compilation
tsc --incremental

# No emit (type check only)
tsc --noEmit

# Emit declarations
tsc --declaration

# Source maps
tsc --sourceMap

# Show diagnostic information
tsc --diagnostic
```

### Compiler Options

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
    "skipDefaultLibCheck": true
  }
}
```

## Tips

- `tsc --noEmit` for fast type checking
- Gradual adoption with `allowJs: true`
- Path mapping for clean imports: `"@/*": ["src/*"]`
- Declaration files: `"declaration": true`
- Source maps: `"sourceMap": true`
- Use `// @ts-ignore` for rare cases
- Use `// @ts-expect-error` with error messages
- Use `// @ts-nocheck` for entire files
