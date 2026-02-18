# AGENTS.md

Personal [Pi Coding Agent](https://buildwithpi.ai/) configuration.

## Stack

- **Runtime**: Bun
- **Language**: TypeScript (ES2022, ESM, strict)
- **Tests**: Vitest
- **VCS**: jj (Jujutsu)

## Commands

```bash
bun install              # Install root deps
bun run install-deps     # Install extension deps
bun run test             # Run tests
bun run format           # Format (prettier)
bun run typecheck        # Type check (tsc)
bun run lint             # Lint (eslint --fix)
```

## Structure

```
agent/
├── extensions/   # Feature modules (TypeScript, export default function)
├── skills/       # Reusable skill definitions (markdown)
├── prompts/      # Prompt templates
└── sessions/     # Conversation storage
```

## Extension Pattern

```typescript
// agent/extensions/<name>/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function extension(pi: ExtensionAPI) {
  // Register hooks, tools, commands
}
```

## Rules

1. Use Bun for all package operations
2. TypeScript strict mode, ESLint must pass
3. Tests alongside code as `*.test.ts`
4. Ignore `agent/git/` (third-party)
