# AGENTS.md - AI Agent Configuration Guide

## Project Overview

**pi-extensions** is a TypeScript-based extension system for a pi-coding-agent that provides Language Server Protocol (LSP) support, code analysis tools, and system integration capabilities.

**Version Control**: Git (jj for Jujutsu)
**Package Manager**: Bun
**Language**: TypeScript (ES2022 target)
**Build Tool**: Vitest

---

## 1. Project Structure

### Directory Layout

```
.
├── agent/                           # Main agent configuration and runtime
│   ├── extensions/                  # Extension packages (feature modules)
│   │   ├── lsp/                    # Language Server Protocol support
│   │   │   ├── lsp.ts              # Main LSP implementation
│   │   │   ├── lsp-tool.ts         # Tool-based LSP operations
│   │   │   ├── core/               # Core LSP functionality
│   │   │   ├── languages/          # Language-specific configurations
│   │   │   ├── servers/            # LSP server implementations
│   │   │   └── tests/              # LSP tests
│   │   ├── ical/                   # iCal calendar integration
│   │   ├── mail/                   # Email integration
│   │   ├── home-assistant/         # Home Assistant integration
│   │   ├── weather/                # Weather API integration
│   │   ├── rodalies/               # Train departure API integration
│   │   ├── npm/                    # npm package search
│   │   ├── pypi/                   # PyPI package search
│   │   ├── nix/                    # NixOS package search
│   │   ├── lsp/                    # Language Server Protocol
│   │   ├── jujutsu/                # Jujutsu-specific tools
│   │   ├── markitdown/             # Markdown conversion
│   │   ├── reverse-history-search/ # History search functionality
│   │   ├── turn-stats/             # Turn statistics
│   │   └── notification/           # Desktop notifications
│   ├── skills/                     # Agent skill definitions
│   │   ├── implementation/         # Implementation skills
│   │   ├── review/                 # Code review skills
│   │   ├── testing/                # Testing skills
│   │   ├── maintenance/            # Maintenance skills
│   │   ├── design/                 # Design skills
│   │   ├── bun/                    # Bun-specific skills
│   │   ├── eslint/                 # ESLint skills
│   │   ├── typescript/             # TypeScript skills
│   │   ├── git/                    # Git skills
│   │   ├── gh/                     # GitHub skills
│   │   ├── tmux/                   # Tmux skills
│   │   └── ...                     # Other skill modules
│   ├── prompts/                    # Prompt templates for agent
│   │   ├── init.md                 # Initialization prompt
│   │   └── test.md                 # Testing prompt
│   ├── sessions/                   # Agent conversation sessions
│   │   └── subagents/              # Subagent sessions
│   ├── git/                        # Third-party extensions (ignore)
│   ├── themes/                     # Theme configurations
│   ├── auth.json                   # Authentication configuration
│   ├── settings.json               # General settings
│   └── models.json                 # Model configurations
├── .codemapper/                    # Code mapper analysis cache
├── .jj/                            # Jujutsu version control
├── package.json                    # Root package manifest
├── bun.lock                        # Bun dependency lockfile
├── vitest.config.ts                # Vitest test configuration
├── tsconfig.json                   # TypeScript compiler config
├── eslint.config.js                # ESLint configuration
└── AGENTS.md                       # This file
```

### Key Directories

- **node_modules/@mariozechner/** - Dependencies and packages from the @mariozechner organization
  - Contains core framework packages and dependencies
  - Installed via Bun package manager from the organization's registry
  - Managed through root package.json and bun.lock
- **agent/extensions/** - Feature modules that extend agent capabilities
  - Each extension has its own `package.json` with `pi.extensions` defined
  - Extensions export hook and tool functionality via `index.ts`
- **agent/skills/** - Reusable skill definitions for code operations
  - Organized by domain: implementation, review, testing, maintenance
  - Each skill is an independent module with its own functionality
- **agent/prompts/** - Prompt templates for agent interaction
  - `init.md`: Agent initialization prompts
  - `test.md`: Testing and validation prompts
- **agent/sessions/** - Persistent conversation storage
  - Each session is a subdirectory with conversation history
- **agent/git/** - Third-party Git extensions (ignore this directory)
- **.codemapper/** - Code mapper analysis cache (generated)

---

## 2. Build Commands

```bash
# Install dependencies
bun install

# Run tests
bun vitest run --dir agent/extensions

# Format code
bun run format

# Lint code
bun run format && bun eslint agent/extensions/**/*.ts

# Type check
bun run typecheck
```

---

## 3. Entry Points & Architecture

### Extension Entry Points

Each extension in `agent/extensions/` exports a default function that receives `pi: ExtensionAPI`:

```typescript
// agent/extensions/<extension-name>/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function <extension-name>Extension(pi: ExtensionAPI) {
  // Extension initialization and setup
  // Register hooks, tools, and commands
}
```

### Extension Directory Structure

```
agent/extensions/<extension-name>/
├── package.json          # Extension manifest (defines exports)
├── index.ts              # Main entry point (default function)
├── <extension>.ts        # Core implementation
├── <extension>-tool.ts   # Tool-based implementation (optional)
├── core/                 # Core functionality (optional)
├── tests/                # Unit tests
└── tsconfig.json         # TypeScript config (if needed)
```

### Extension Patterns

**Standard Extension** (`home-assistant`, `mail`, `weather`, etc.):

```typescript
// index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function <extension-name>Extension(pi: ExtensionAPI) {
  // Initialize extension
  // Register hooks, tools, and commands
}
```

**Complex Extension** (`lsp`, `turn-stats`):

```typescript
// index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Export utility functions
export function formatDuration(ms: number): string;

// Export main extension
export default function <extension-name>Extension(pi: ExtensionAPI) {
  // Initialize extension
  // Register hooks, tools, and commands
}
```

- Provides public API for the agent

2. **Core Layer** (`<extension>.ts`, `core/`)
   - Implements core extension logic
   - Manages state and operations

3. **Tool Layer** (`<extension>-tool.ts`)
   - Provides tool-based operations for the agent
   - Implements specific tool capabilities

4. **Test Layer** (`tests/`)
   - Unit tests for core functionality
   - Integration tests for tool operations

### TypeScript Configuration

**Compiler Options** (tsconfig.json):

- Target: ES2022
- Module: ESNext (ESM)
- Module Resolution: bundler
- Strict Mode: enabled
- Type Definitions: node, vitest/globals

**ESLint Rules**:

- Recommended rules enabled
- Unused variables ignored (prefixed with `_`)
- Any type: warning only
- Empty blocks: allowed (for specific use cases)
- Useless escape: allowed (for valid escaping)

---

## 4. Dependencies & Packages

### Root Dependencies (package.json)

**Core Framework**:

- `@mariozechner/pi-agent-core` - Core agent framework
- `@mariozechner/pi-ai` - AI integration
- `@mariozechner/pi-coding-agent` - Coding agent functionality
- `@mariozechner/pi-tui` - Terminal UI

**Type Systems**:

- `@sinclair/typebox` - Type schemas for runtime validation

**Utilities**:

- `@toon-format/toon` - Toon format for structured output

### Dev Dependencies

**Testing**:

- `vitest` - Test framework (configured in vitest.config.ts)

**Code Quality**:

- `typescript` - TypeScript compiler
- `@typescript-eslint/eslint-plugin` - TypeScript linting
- `@typescript-eslint/parser` - TypeScript parser for ESLint
- `eslint` - JavaScript/TypeScript linter
- `globals` - Global variables for ESLint
- `prettier` - Code formatter

### Extension Dependencies

Each extension has its own `package.json` with dependencies:

**Common Dependencies**:

- `@mariozechner/pi-ai` - AI integration
- `@mariozechner/pi-coding-agent` - Coding agent
- `@mariozechner/pi-tui` - Terminal UI
- `@sinclair/typebox` - Type schemas
- `vscode-languageserver-protocol` - LSP protocol

**Extension-Specific**:

- `lsp`: Language server implementations for multiple languages
- `npm`: npm registry integration
- `pypi`: PyPI registry integration
- `nix`: NixOS package integration
- `ical`: iCal calendar parsing
- `mail`: Email handling
- `home-assistant`: Home Assistant API
- `weather`: Weather API
- `rodalies`: Train API

---

## 5. Development Workflow

### Creating a New Extension

1. Create directory: `agent/extensions/<extension-name>/`
2. Create `package.json`:
   ```json
   {
     "name": "<extension-name>",
     "version": "1.0.0",
     "description": "Extension description",
     "scripts": {
       "test": "bun vitest run tests/*.test.ts"
     },
     "type": "module",
     "pi": {
       "extensions": ["./<extension>.ts", "./<extension>-tool.ts"]
     },
     "dependencies": {
       "@mariozechner/pi-ai": "^0.48.0",
       "@mariozechner/pi-coding-agent": "^0.48.0",
       "@sinclair/typebox": "^0.34.47"
     }
   }
   ```
3. Create `index.ts`:

   ```typescript
   import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

   export default function <extension-name>Extension(pi: ExtensionAPI) {
     // Initialize extension
     // Register hooks, tools, and commands
   }
   ```

4. Add tests in `tests/` directory
5. Run `bun run install-deps` to install dependencies

### Creating a New Skill

1. Create directory: `agent/skills/<skill-name>/`
2. Implement skill logic
3. Import and use skill in agent sessions
4. Add to skill catalog in `agent/skills/`

### Testing Extensions

```bash
# Test specific extension
cd agent/extensions/<extension-name>
bun run test

# Run all extension tests
bun run test

# Run in watch mode
bun run test --watch
```

---

## 6. Key Architectural Decisions

### Module Organization

- **Feature-based**: Extensions organized by domain (lsp, mail, weather, etc.)
- **Export Pattern**: Named exports for hooks/tools, named exports for core
- **File Naming**: kebab-case for components, camelCase for utilities

### TypeScript Strategy

- **ESM Modules**: All extensions use ESNext module system
- **Strict Mode**: Enable strict type checking for safety
- **No Emit**: TypeScript compiles but doesn't generate output (run via Bun)

### Testing Strategy

- **Unit Tests**: Per-extension test suites
- **Integration Tests**: Tool-based integration tests
- **Watch Mode**: Development workflow with automatic test rerun

### Dependency Management

- **Workspace**: Bun workspaces for shared dependencies
- **Extension Isolation**: Each extension has its own package.json
- **Version Pinning**: Dependencies pinned to specific versions

---

## 7. AI Agent Guidelines

### File Types & Patterns

- **Entry Points**: `agent/extensions/*/index.ts`
- **Core Logic**: `agent/extensions/*/*.ts` and `*.tool.ts`
- **Tests**: `agent/extensions/*/tests/*.test.ts`
- **Configuration**: `package.json`, `tsconfig.json`, `eslint.config.js`

### Common Operations

- **Add Extension**: Create directory with package.json and index.ts
- **Add Skill**: Create directory in `agent/skills/`
- **Run Tests**: `bun run test`
- **Format Code**: `bun run format`
- **Lint Code**: `bun eslint agent/extensions/**/*.ts`

### Must-Know Rules

1. All extensions must have `package.json` with `pi.extensions` defined
2. Extensions export hooks and tools via `index.ts`
3. Use Bun for all package management and running scripts
4. TypeScript files must pass ESLint and strict type checking
5. Tests use Vitest with watch mode for development
6. Extensions are independent modules with their own dependencies

### Error Handling Patterns

- Use `@sinclair/typebox` for runtime type validation
- Follow TypeScript strict mode (no implicit any, explicit return types)
- Handle errors gracefully in tool implementations
- Use try-catch blocks for external API calls

### Version Control

- Git for general version control
- jj (Jujutsu) for more sophisticated version management
- Changes tracked in `.jj/` directory
