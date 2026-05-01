# skill-reminder

A pi extension that uses semantic search over your skill files to automatically surface relevant skills when they match the current context.

## Features

**Error-time reminders** — When a tool call fails, the full invocation (tool name plus all arguments) and the error output are embedded together and searched against your skill index. Matching skill snippets are appended to the tool result so the LLM can self-correct.

**Input-time reminders** — On every user input (including steering and follow-up messages during streaming), the text is embedded and matched against the skill index. Relevant skills are prepended to the user's message as a `## Relevant Skills` section, priming the agent with the right context.

## How It Works

1. On startup, all `.md` files under `~/.pi/agent/skills/` are parsed into heading-delimited chunks
2. Each chunk is embedded via an OpenAI-compatible embeddings API (Ollama by default)
3. The index is cached in `~/.cache/pi-skill-reminder/index.json` and only rebuilt when skill files change
4. On error, the tool name, full invocation arguments, and error output are embedded together and matched skills are appended to the tool result. On user input, the text is embedded and matched skills are prepended to the message

## Installation

Place the extension directory in your pi extensions path:

```bash
cp -r agent/extensions/skill-reminder ~/.pi/agent/extensions/skill-reminder
cd ~/.pi/agent/extensions/skill-reminder && npm install
```

Or run directly:

```bash
pi -e ./agent/extensions/skill-reminder/index.ts
```

## Configuration

Add a `skillReminder` key to `~/.pi/agent/settings.json`:

```json
{
  "skillReminder": {
    "enabled": true,
    "serverUrl": "http://localhost:11434/v1/embeddings",
    "embeddingModel": "unsloth/embeddinggemma-300m-GGUF",
    "scoreThreshold": 0.6,
    "maxSkills": 4,
    "chunkMaxChars": 1000,
    "promptScoreThreshold": 0.6
  }
}
```

### Settings

| Setting                | Type      | Default                                | Description                                         |
| ---------------------- | --------- | -------------------------------------- | --------------------------------------------------- |
| `enabled`              | `boolean` | `true`                                 | Enable/disable the entire extension                 |
| `serverUrl`            | `string`  | `http://localhost:11434/v1/embeddings` | OpenAI-compatible embeddings endpoint               |
| `embeddingModel`       | `string`  | `unsloth/embeddinggemma-300m-GGUF`     | Model name for the embeddings API                   |
| `scoreThreshold`       | `number`  | `0.6`                                  | Minimum cosine similarity for error-time reminders  |
| `maxSkills`            | `number`  | `4`                                    | Maximum number of skills to include in a reminder   |
| `chunkMaxChars`        | `number`  | `1000`                                 | Maximum characters per chunk before truncation      |
| `promptScoreThreshold` | `number`  | `0.6`                                  | Minimum cosine similarity for prompt-time reminders |

## Architecture

```
index.ts          Extension entry point — hooks into tool_result and input events
rag.ts            Query building, reminder formatting, scoring, and ranking logic
parser.ts         Markdown parsing — chunks SKILL.md files by headings using mdast
embeddings.ts     Embedding API client with batching and timeout support
cache.ts          Binary-free JSON cache with mtime-based invalidation
index-builder.ts  Orchestrates parsing, embedding, and caching at startup
settings.ts       Config loading from ~/.pi/agent/settings.json
progress.ts       Terminal progress bar for batch embedding
guards.ts         Type guards for content item validation
```

## Cache Behavior

The index is cached in `~/.cache/pi-skill-reminder/index.json`. On each startup:

1. Load the cache
2. Compare file mtimes against the current skills directory
3. If any file is newer or a new file exists, rebuild the full index
4. Otherwise use the cached embeddings

## Dependencies

| Package                     | Purpose                              |
| --------------------------- | ------------------------------------ |
| `@huggingface/transformers` | Local embedding fallback (optional)  |
| `mdast-util-from-markdown`  | Parse markdown into AST for chunking |
| `mdast-util-to-string`      | Extract text from AST nodes          |
| `unist-util-visit`          | Walk the markdown AST tree           |
