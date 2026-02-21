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

## User Preferences

- **Scripting**: Prefer nu-shell (`nu`) over bash for complex scripts
- **TypeScript only**: Never create `.js` files, always `.ts`
- **No regex for parsing**: Use proper parsers (HTML, JSON, etc.)
- **No re-exports**: Import directly from source modules

## Tool Best Practices

### Edit Tool

- **Always read the file first** before editing to get exact content
- After failed edit, re-read the file - content may have changed
- Match whitespace exactly (quotes, indentation, newlines)
- Use smaller, targeted edits over large replacements

### Bash Tool

- Use `grep ... || true` when no match is acceptable
- Use `jj` for version control, not `git` (see jujutsu skill)
- Jujutsu parent syntax: `@-` not `@~1` or `@^`
- Avoid `cd /path &&` - use absolute paths or rely on cwd
- For file checks: `test -f file` or `[[ -f file ]]`
- Verify paths exist before multi-step operations: `[[ -d /path ]] && cmd`

### Pi Session Tools

- Use `pi-list-projects` to discover valid project paths
- Project paths are auto-resolved from cwd when not specified
- Session indices: `0` = most recent, `1` = second most recent
