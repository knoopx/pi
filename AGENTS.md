# Agent Coding Guidelines for Pi Coding Agent

This document provides essential guidelines for coding agents operating in this Pi Coding Agent configuration repository. It includes build/lint/test commands, code style guidelines, and project-specific conventions.

## Build/Lint/Test Commands

### Package Management
- **Install root dependencies**: `bun install`
- **Update root dependencies**: `bun update`
- **Install extension dependencies**: `find agent/extensions -name package.json -execdir bun install \;`
- **Update extension dependencies**: `find agent/extensions -name package.json -execdir bun update \;`

### Formatting
- **Format code**: `bun run format` or `prettier --write "agent/extensions/**/*.ts"`
- **Check formatting**: `bun run format-check` or `prettier --check "agent/extensions/**/*.ts"`

### Testing
- **Run all tests**: `bun test`
- **Run tests in watch mode**: `bun test --watch`
- **Run specific test file**: `bun test path/to/test-file.test.ts`
- **Run single test**: `bun test -t "test description"`
- **Run tests with coverage**: `bun test --coverage`
- **Run tests for specific extension**: `bun test agent/extensions/extension-name/`

### TypeScript Compilation
- **Type check**: `bunx tsc --noEmit`
- **Build for production**: `bunx tsc` (if output directory is configured)

## Code Style Guidelines

### TypeScript Configuration
This project uses strict TypeScript configuration:
- Target: ES2022 with DOM types
- Module: ESNext
- Strict mode enabled
- No implicit any, unused variables/parameters
- Explicit return types for exported functions
- Includes Vitest globals for testing

### Naming Conventions
- **Files**: Use kebab-case (e.g., `github-api.ts`, `lsp-core.ts`)
- **Functions/Variables**: Use camelCase (e.g., `registerTool`, `validateParams`)
- **Classes/Interfaces/Types**: Use PascalCase (e.g., `ToolDefinition`, `ApiResponse`)
- **Constants**: Use UPPER_SNAKE_CASE for global constants
- **Private members**: Prefix with underscore (e.g., `_privateMethod`)
- **Extensions**: Name folders with kebab-case matching main export

### Import/Export Style
```typescript
// Group imports: standard library, third-party, local
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { z } from "zod";

// Use named exports over default exports for utilities
export { setupExtension, validateCommand };

// Default export for extensions
export default function (pi: ExtensionAPI) { /* ... */ }

// Avoid namespace imports except for testing utilities
import { describe, it, expect, vi } from "vitest";
```

### Extension Development Patterns
```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // Register tools with TypeBox schemas
  pi.registerTool({
    name: "tool-name",
    label: "Human Readable Label",
    description: "Tool description",
    parameters: Type.Object({
      param: Type.String({ description: "Parameter description" }),
    }),

    async execute(toolCallId, params, onUpdate, ctx, signal) {
      // Implementation with proper error handling
      try {
        const result = await someOperation(params, signal);
        return {
          content: [{ type: "text", text: result }],
          details: { result },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
          details: {},
        };
      }
    },
  });

  // Register commands
  pi.registerCommand("command-name", {
    description: "Command description",
    handler: async (args, ctx) => {
      // Command implementation
    },
  });
}
```

### Type Safety
- **Avoid `any`**: Use `unknown` for uncertain types, create proper type definitions
- **Use branded types** for primitive types needing runtime validation
- **Discriminated unions** for mutually exclusive states
- **Validate inputs at boundaries** using TypeBox schemas and type guards
- **Use `as const`** for literal type assertions

### Error Handling
```typescript
// Custom error classes extending Error
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Result types for explicit error handling
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Async operations with proper error handling
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return { content: [{ type: "text", text: JSON.stringify(data) }], details: { data } };
} catch (error) {
  return {
    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
    details: {},
  };
}
```

### Testing Patterns
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

describe("Extension Name", () => {
  let mockPi: ExtensionAPI;
  let mockContext: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      // ... other mocks
    } as any;
    mockContext = { /* setup */ };
  });

  it("should register tool with correct parameters", () => {
    // Arrange
    const extension = require("./index").default;

    // Act
    extension(mockPi);

    // Assert
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "expected-tool-name",
        parameters: expect.any(Object),
      })
    );
  });

  it("should handle errors gracefully", async () => {
    // Mock failure scenario
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    // Test error handling
    const result = await tool.execute("id", {}, vi.fn(), mockContext);
    expect(result.isError).toBe(true);
  });
});
```

### Code Organization
```
agent/extensions/
├── extension-name/
│   ├── index.ts          # Main extension export and tool registration
│   ├── core.ts           # Core business logic (if complex)
│   ├── types.ts          # Type definitions specific to extension
│   └── index.test.ts     # Tests for the extension
```

### Documentation
- **JSDoc** for public APIs: `@param`, `@returns`, `@example`
- **Types serve as documentation** - prefer self-documenting code
- **Inline comments** for complex business logic, not obvious implementations
- **README.md** in extension folders for complex extensions

### Performance Considerations
- **Minimize type complexity** in frequently used types
- **Use `const` assertions** for literal types: `as const`
- **Prefer interfaces** over types for object shapes (better IntelliSense)
- **Use `readonly`** for immutable data structures
- **Signal handling** for cancellable operations

### Best Practices
1. **Fail fast**: Validate inputs early, use strict TypeScript settings
2. **Single responsibility**: Each tool/command should do one thing well
3. **DRY principle**: Extract common patterns, avoid code duplication
4. **YAGNI**: Don't add features until they're needed
5. **Type at boundaries**: Define clear interfaces between extensions
6. **Test behavior, not implementation**: Focus on what code does
7. **Handle cancellation**: Always respect AbortSignal in async operations
8. **Provide user feedback**: Use `ctx.ui.notify()` for important messages
9. **Graceful degradation**: Handle missing dependencies/tools gracefully

## Project-Specific Conventions

### Extension Registration
- Always check tool availability in `session_start` event
- Use consistent naming: kebab-case for tool names, Title Case for labels
- Provide detailed parameter descriptions in TypeBox schemas
- Return structured results with `content` and `details` fields

### Tool Parameters
- Use TypeBox for runtime type validation
- Include `description` fields for all parameters
- Use appropriate TypeBox types (String, Number, Boolean, etc.)
- Mark optional parameters with `Type.Optional()`

### Error Responses
- Always return `isError: true` for failures
- Include error message in content array
- Provide empty `details` object for errors
- Use descriptive error messages

## Available Skills & Tools

This repository uses various skills and tools. See the full list in the project documentation for available capabilities including ast-grep, bun, nix, podman, and many others.</content>