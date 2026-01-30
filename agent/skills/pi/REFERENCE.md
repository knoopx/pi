# Pi Extensions Reference

Extensions are TypeScript modules that extend pi's behavior. They subscribe to lifecycle events, register custom tools callable by the LLM, add commands, and more.

## Extension API

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function myExtension(pi: ExtensionAPI) {
  // Subscribe to events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register a custom tool
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register a command
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

## Extension Manifest

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "Extension description",
  "type": "module",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "dependencies": {
    "@mariozechner/pi-coding-agent": "^0.48.0"
  }
}
```

## Extension Locations

Extensions are auto-discovered from:

| Location                            | Scope                        |
| ----------------------------------- | ---------------------------- |
| `~/.pi/agent/extensions/*.ts`       | Global (all projects)        |
| `~/.pi/agent/extensions/*/index.ts` | Global (subdirectory)        |
| `.pi/extensions/*.ts`               | Project-local                |
| `.pi/extensions/*/index.ts`         | Project-local (subdirectory) |

Additional paths via `settings.json`:

```json
{
  "packages": ["npm:@foo/bar@1.0.0", "git:github.com/user/repo@v1"],
  "extensions": ["/path/to/local/extension.ts", "/path/to/local/extension/dir"]
}
```

## Available Imports

| Package                         | Purpose                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `@mariozechner/pi-coding-agent` | Extension types (`ExtensionAPI`, `ExtensionContext`, events) |
| `@sinclair/typebox`             | Schema definitions for tool parameters                       |
| `@mariozechner/pi-ai`           | AI utilities (`StringEnum` for Google-compatible enums)      |
| `@mariozechner/pi-tui`          | TUI components for custom rendering                          |

npm dependencies work too. Add a `package.json` next to your extension (or in a parent directory), run `npm install`, and imports from `node_modules/` are resolved automatically.

Node.js built-ins (`node:fs`, `node:path`, etc.) are also available.

## Extension Styles

**Single file** - simplest, for small extensions:

```
~/.pi/agent/extensions/
└── my-extension.ts
```

**Directory with index.ts** - for multi-file extensions:

```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts        # Entry point (exports default function)
    ├── tools.ts        # Helper module
    └── utils.ts        # Helper module
```

**Package with dependencies** - for extensions that need npm packages:

```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json    # Declares dependencies and entry points
    ├── package-lock.json
    ├── node_modules/   # After npm install
    └── src/
        └── index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": {
    "zod": "^3.0.0",
    "chalk": "^5.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

Run `npm install` in the extension directory, then imports from `node_modules/` work automatically.

## ExtensionContext

Every handler receives `ctx: ExtensionContext`:

### ctx.ui

UI methods for user interaction. See [Custom UI](#custom-ui) for full details.

### ctx.hasUI

`false` in print mode (`-p`), JSON mode, and RPC mode. Always check before using `ctx.ui`.

### ctx.cwd

Current working directory.

### ctx.sessionManager

Read-only access to session state.

```typescript
ctx.sessionManager.getEntries(); // All entries
ctx.sessionManager.getBranch(); // Current branch
ctx.sessionManager.getLeafId(); // Current leaf entry ID
```

### ctx.modelRegistry / ctx.model

Access to models and API keys.

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

Control flow helpers.

### ctx.shutdown()

Request a graceful shutdown of pi.

### ctx.getContextUsage()

Returns current context usage for the active model.

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

Trigger compaction without awaiting completion.

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => {
    ctx.ui.notify("Compaction completed", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

Returns the current effective system prompt.

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`System prompt length: ${prompt.length}`);
});
```

## ExtensionCommandContext

Command handlers receive `ExtensionCommandContext`, which extends `ExtensionContext` with session control methods.

### ctx.waitForIdle()

Wait for the agent to finish streaming.

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // Agent is now idle, safe to modify session
  },
});
```

### ctx.newSession(options?)

Create a new session.

```typescript
const result = await ctx.newSession({
  parentSession: ctx.sessionManager.getSessionFile(),
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Context from previous session..." }],
      timestamp: Date.now(),
    });
  },
});

if (result.cancelled) {
  // An extension cancelled the new session
}
```

### ctx.fork(entryId)

Fork from a specific entry, creating a new session file.

```typescript
const result = await ctx.fork("entry-id-123");
if (!result.cancelled) {
  // Now in the forked session
}
```

### ctx.navigateTree(targetId, options?)

Navigate to a different point in the session tree.

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "Focus on error handling changes",
  replaceInstructions: false, // true = replace default prompt entirely
  label: "review-checkpoint",
});
```

## ExtensionAPI Methods

### pi.on(event, handler)

Subscribe to events. See [Events](#events) for event types and return values.

### pi.registerTool(definition)

Register a custom tool callable by the LLM.

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, onUpdate, ctx, signal) {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },
});
```

### pi.sendMessage(message, options?)

Inject a custom message into the session.

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "Message text",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

### pi.sendUserMessage(content, options?)

Send a user message to the agent.

```typescript
pi.sendUserMessage("What is 2+2?");
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
```

### pi.appendEntry(customType, data?)

Persist extension state.

```typescript
pi.appendEntry("my-state", { count: 42 });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

### pi.setSessionName(name)

Set the session display name.

```typescript
pi.setSessionName("Refactor auth module");
```

### pi.getSessionName()

Get the current session name.

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

### pi.setLabel(entryId, label)

Set or clear a label on an entry.

```typescript
// Set a label
pi.setLabel(entryId, "checkpoint-before-refactor");

// Clear a label
pi.setLabel(entryId, undefined);
```

### pi.registerCommand(name, options)

Register a command.

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  },
});
```

### pi.registerMessageRenderer(customType, renderer)

Register a custom TUI renderer for messages.

### pi.registerShortcut(shortcut, options)

Register a keyboard shortcut.

### pi.registerFlag(name, options)

Register a CLI flag.

### pi.exec(command, args, options?)

Execute a shell command.

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

Manage active tools.

```typescript
const active = pi.getActiveTools(); // ["read", "bash", "edit", "write"]
const all = pi.getAllTools(); // [{ name: "read", description: "Read file contents..." }, ...]
const names = all.map((t) => t.name); // Just names if needed
pi.setActiveTools(["read", "bash"]); // Switch to read-only
```

### pi.setModel(model)

Set the current model. Returns `false` if no API key is available for the model.

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("No API key for this model", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

Get or set the thinking level.

```typescript
const current = pi.getThinkingLevel(); // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
pi.setThinkingLevel("high");
```

### pi.events

Shared event bus for communication between extensions.

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### pi.registerProvider(name, config)

Register or override a model provider dynamically.

```typescript
pi.registerProvider("my-proxy", {
  baseUrl: "https://proxy.example.com",
  apiKey: "PROXY_API_KEY",
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (proxy)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384,
    },
  ],
});
```

## Events

### Lifecycle Overview

```
pi starts
  │
  └─► session_start
      │
      ▼
user sends prompt ─────────────────────────────────────────┐
  │                                                        │
  ├─► (extension commands checked first, bypass if found)  │
  ├─► input (can intercept, transform, or handle)          │
  ├─► (skill/template expansion if not handled)            │
  ├─► before_agent_start (can inject message, modify system prompt)
  ├─► agent_start                                          │
  │                                                        │
  │   ┌─── turn (repeats while LLM calls tools) ───┐       │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context (can modify messages)            │       │
  │   │                                            │       │
  │   │   LLM responds, may call tools:            │       │
  │   │     ├─► tool_call (can block)              │       │
  │   │     │   tool executes                      │       │
  │   │     └─► tool_result (can modify)           │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  └─► agent_end                                            │
                                                           │
user sends another prompt ◄────────────────────────────────┘

/new (new session) or /resume (switch session)
  ├─► session_before_switch (can cancel)
  └─► session_switch

/fork
  ├─► session_before_fork (can cancel)
  └─► session_fork

/compact or auto-compaction
  ├─► session_before_compact (can cancel or customize)
  └─► session_compact

/tree navigation
  ├─► session_before_tree (can cancel or customize)
  └─► session_tree

/model or Ctrl+P (model selection/cycling)
  └─► model_select

exit (Ctrl+C, Ctrl+D)
  └─► session_shutdown
```

### Session Events

#### session_start

Fired on initial session load.

#### session_before_switch / session_switch

Fired when starting a new session (`/new`) or switching sessions (`/resume`).

#### session_before_fork / session_fork

Fired when forking via `/fork`.

#### session_before_compact / session_compact

Fired on compaction.

#### session_before_tree / session_tree

Fired on `/tree` navigation.

#### session_shutdown

Fired on exit (Ctrl+C, Ctrl+D, SIGTERM).

### Agent Events

#### before_agent_start

Fired after user submits prompt, before agent loop. Can inject a message and/or modify the system prompt.

#### agent_start / agent_end

Fired once per user prompt.

#### turn_start / turn_end

Fired for each turn (one LLM response + tool calls).

#### context

Fired before each LLM call. Modify messages non-destructively.

### Model Events

#### model_select

Fired when the model changes via `/model` command, model cycling (`Ctrl+P`), or session restore.

### Tool Events

#### tool_call

Fired before tool executes. **Can block.**

#### tool_result

Fired after tool executes. **Can modify result.**

### User Bash Events

#### user_bash

Fired when user executes `!` or `!!` commands. **Can intercept.**

### Input Events

#### input

Fired when user input is received, after extension commands are checked but before skill and template expansion.

## Custom Tools

### Tool Definition

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, onUpdate, ctx, signal) {
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }

    onUpdate?.({
      content: [{ type: "text", text: "Working..." }],
      details: { progress: 50 },
    });

    const result = await pi.exec("some-command", [], { signal });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { data: result },
    };
  },
});
```

### Overriding Built-in Tools

Extensions can override built-in tools (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`) by registering a tool with the same name.

### Remote Execution

Built-in tools support pluggable operations for delegating to remote systems (SSH, containers, etc.).

### Output Truncation

**Tools MUST truncate their output** to avoid overwhelming the LLM context. The built-in limit is **50KB** (~10k tokens) and **2000 lines**, whichever is hit first.

```typescript
import {
  truncateHead,      // Keep first N lines/bytes
  truncateTail,      // Keep last N lines/bytes
  truncateLine,      // Truncate a single line
  formatSize,        // Human-readable size
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from "@mariozechner/pi-coding-agent";

async execute(toolCallId, params, onUpdate, ctx, signal) {
  const output = await runCommand();

  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    const tempFile = writeTempFile(output);

    result += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
    result += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
    result += ` Full output saved to: ${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

## Custom UI

### Dialogs

```typescript
const choice = await ctx.ui.select("Pick one:", ["A", "B", "C"]);
const ok = await ctx.ui.confirm("Delete?", "This cannot be undone");
const name = await ctx.ui.input("Name:", "placeholder");
const text = await ctx.ui.editor("Edit:", "prefilled text");
ctx.ui.notify("Done!", "info");
```

### Widgets, Status, and Footer

```typescript
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setWorkingMessage("Thinking deeply...");
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
ctx.ui.setFooter((tui, theme) => ({
  render(width) {
    return [theme.fg("dim", "Custom footer")];
  },
  invalidate() {},
}));
ctx.ui.setTitle("pi - my-project");
ctx.ui.setEditorText("Prefill text");
```

### Custom Components

```typescript
import { Text, Component } from "@mariozechner/pi-tui";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);

  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return text;
});
```

### Custom Editor

Replace the main input editor with a custom implementation:

```typescript
import { CustomEditor } from "@mariozechner/pi-coding-agent";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    if (this.mode === "normal" && data === "i") {
      this.mode = "insert";
      return;
    }
    super.handleInput(data);
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent(
      (_tui, theme, keybindings) => new VimEditor(theme, keybindings),
    );
  });
}
```

## Error Handling

- Extension errors are logged, agent continues
- `tool_call` errors block the tool (fail-safe)
- Tool `execute` errors are reported to the LLM with `isError: true`

## Mode Behavior

| Mode                 | UI Methods    | Notes                           |
| -------------------- | ------------- | ------------------------------- |
| Interactive          | Full TUI      | Normal operation                |
| RPC (`--mode rpc`)   | JSON protocol | Host handles UI                 |
| JSON (`--mode json`) | No-op         | Event stream to stdout          |
| Print (`-p`)         | No-op         | Extensions run but can't prompt |

## Examples Reference

All examples in [examples/extensions/](../examples/extensions/).

| Example                      | Description                    | Key APIs                                |
| ---------------------------- | ------------------------------ | --------------------------------------- |
| **Tools**                    |                                |                                         |
| `hello.ts`                   | Minimal tool registration      | `registerTool`                          |
| `question.ts`                | Tool with user interaction     | `registerTool`, `ui.select`             |
| `questionnaire.ts`           | Multi-step wizard tool         | `registerTool`, `ui.custom`             |
| `todo.ts`                    | Stateful tool with persistence | `registerTool`, `appendEntry`           |
| `truncated-tool.ts`          | Output truncation example      | `registerTool`, `truncateHead`          |
| **Commands**                 |                                |                                         |
| `pirate.ts`                  | Modify system prompt per-turn  | `registerCommand`, `before_agent_start` |
| **Events & Gates**           |                                |                                         |
| `permission-gate.ts`         | Block dangerous commands       | `on("tool_call")`, `ui.confirm`         |
| `input-transform.ts`         | Transform user input           | `on("input")`                           |
| **UI Components**            |                                |                                         |
| `status-line.ts`             | Footer status indicator        | `setStatus`, session events             |
| `modal-editor.ts`            | Vim-style modal editor         | `setEditorComponent`, `CustomEditor`    |
| **Complex Extensions**       |                                |                                         |
| `plan-mode/`                 | Full plan mode implementation  | All event types                         |
| `preset.ts`                  | Saveable presets               | `registerCommand`, `setModel`           |
| **Remote & Sandbox**         |                                |                                         |
| `ssh.ts`                     | SSH remote execution           | `registerFlag`, `on("user_bash")`       |
| `sandbox/`                   | Sandboxed tool execution       | Tool operations                         |
| **Games**                    |                                |                                         |
| `snake.ts`                   | Snake game                     | `registerCommand`, `ui.custom`          |
| **Providers**                |                                |                                         |
| `custom-provider-anthropic/` | Custom Anthropic proxy         | `registerProvider`                      |

For more information, see the [pi-mono documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md).
