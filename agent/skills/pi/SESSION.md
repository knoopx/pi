# Session Management Reference

Pi uses tree-structured sessions that store conversation history. This provides powerful navigation, branching, and sharing capabilities.

## Session Files

Sessions are stored in JSON files:

- **Global**: `~/.pi/agent/sessions/`
- **Project**: `.pi/sessions/`

Each session file contains:

- Conversation tree
- Metadata (creation time, model)
- Labels and bookmarks

## Session Commands

- `/new` - Create fresh session
- `/resume` - Switch to existing session
- `/tree` - Navigate session tree
- `/export` - Export to HTML
- `/share` - Upload to GitHub gist
- `/compact` - Trigger compaction

See [REFERENCE.md](REFERENCE.md) for complete API reference.

## Session Tree Structure

```
Session
├── Branch 1
│   ├── Entry 1 (Turn 1)
│   └── Entry 2 (Turn 2)
└── Branch 2
    └── Entry 1 (Turn 1)
```

## Labels and Bookmarks

Set labels for navigation:

```bash
/set-label checkpoint
```

Navigate to labeled entries in `/tree`.

## Session Events

Extensions can listen to session events:

```typescript
pi.on("session_start", async (_event, ctx) => {
  ctx.ui.notify("Session loaded!", "info");
});

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, signal } = event;
  // Cancel compaction
  return { cancel: true };
  // Custom summary
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    },
  };
});
```

## Session Metadata

```typescript
// Set session name
pi.setSessionName("Refactor auth module");

// Get session info
const sessionFile = ctx.sessionManager.getSessionFile();
const entries = ctx.sessionManager.getEntries();
const branch = ctx.sessionManager.getBranch();
const leafId = ctx.sessionManager.getLeafId();
```

## Forking Sessions

Fork creates a new session from a specific entry:

```typescript
const result = await ctx.fork("entry-id-123", {
  summarize: true,
  customInstructions: "Focus on error handling changes",
  label: "review-checkpoint",
});
```

## Compaction

Compaction summarizes older messages when approaching the context limit.

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => {
    ctx.ui.notify("Compaction completed", "info");
  },
});
```

## Session Persistence

Extensions can persist state in sessions:

```typescript
// Save state
pi.appendEntry("my-state", { count: 42 });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

## Session Best Practices

- Keep sessions focused on a single task
- Use labels for important checkpoints
- Trigger compaction regularly on long conversations
- Fork for parallel conversations
- Name sessions for organization
- Export important sessions for documentation

See [REFERENCE.md](REFERENCE.md) for complete session API details.
