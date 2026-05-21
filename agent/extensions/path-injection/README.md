# Path Injection

Automatically attaches directory tree listings and file lists to prompts that reference glob expressions.

When the user mentions a glob pattern (e.g., `src/**/*.ts`, `/usr/bin/*`, `agent/extensions/*`), this extension detects it, expands the pattern using Node.js `fs/promises` glob, runs `tree --gitignore` on matched directories, and lists matched files. This gives the agent immediate visibility into directory structures without requiring explicit tool calls.

Plain paths (e.g., `/usr/bin`, `./src`) are ignored — only patterns containing glob characters (`*`, `?`, `[`, `]`) trigger injection.

## How It Works

1. Listens for the `input` event on every user message (skips extension-sourced input).
2. Scans the text for paths containing glob characters (`*`, `?`, `[`, `]`). Supports absolute (`/foo/*`), relative (`./lib/**/*`), and bare paths (`agent/**/*.ts`). Also extracts patterns from quoted strings.
3. Expands each glob pattern using `fs/promises` glob resolved against `ctx.cwd`.
4. Runs `tree --gitignore` (2 s timeout) on each matched directory. Lists matched files directly.
5. Appends all tree outputs and file lists to the original prompt with `Glob: <pattern>` headers.

## Configuration

No configuration required. Install as a pi extension and it activates automatically.

## Dependencies

Requires `tree` to be available on `$PATH`. Uses Node.js 20+ `fs/promises` glob (no extra packages).
