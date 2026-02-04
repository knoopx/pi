#!/usr/bin/env bun
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

type OpencodeSession = {
  id: string;
  directory: string;
  time?: {
    created?: number;
  };
  title?: string;
};

type OpencodeMessage = {
  id: string;
  sessionID: string;
  role: "user" | "assistant" | "system";
  time?: {
    created?: number;
  };
  error?: {
    name?: string;
    data?: {
      message?: string;
    };
  };
};

type OpencodePart = {
  id: string;
  messageID: string;
  type: string;
  text?: string;
  tool?: string;
  state?: {
    status?: string;
    input?: unknown;
    output?: string;
    title?: string;
    metadata?: {
      output?: string;
    };
    time?: {
      start?: number;
      end?: number;
    };
  };
  filename?: string;
  url?: string;
  source?: {
    text?: {
      value?: string;
    };
    path?: string;
  };
  files?: string[];
  hash?: string;
  snapshot?: string;
  time?: {
    start?: number;
    end?: number;
  };
};

type PiSessionLine = {
  type: "session";
  version: 3;
  id: string;
  timestamp: string;
  cwd: string;
};

type PiMessageLine = {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: {
    role: "user" | "assistant" | "system";
    content: { type: "text"; text: string }[];
    timestamp: number;
    errorMessage?: string;
  };
};

const DEFAULT_OPENCODE_ROOT = path.join(
  os.homedir(),
  ".local",
  "share",
  "opencode",
  "storage",
);
const DEFAULT_PI_ROOT = path.join(os.homedir(), ".pi", "agent", "sessions");

const args = new Set(process.argv.slice(2));
const opencodeRoot = getArgValue("--opencode-root") ?? DEFAULT_OPENCODE_ROOT;
const piRoot = getArgValue("--pi-root") ?? DEFAULT_PI_ROOT;
const shouldWrite = args.has("--write");

async function main() {
  const sessionDir = path.join(opencodeRoot, "session");
  const sessionFiles = await listSessionFiles(sessionDir);

  if (sessionFiles.length === 0) {
    console.log("No opencode session files found.");
    return;
  }

  for (const sessionFile of sessionFiles) {
    const session = await readJson<OpencodeSession>(sessionFile);
    if (!session.id || !session.directory) {
      continue;
    }

    const sessionTimestamp = new Date(session.time?.created ?? Date.now());
    const sessionIso = sessionTimestamp.toISOString();
    const piSessionId = crypto.randomUUID();
    const outputDir = path.join(piRoot, toPiSessionDir(session.directory));
    const outputFile = path.join(
      outputDir,
      `${formatTimestampForFilename(sessionIso)}_${crypto.randomUUID()}.jsonl`,
    );

    const messageLines = await buildMessageLines(session.id, piSessionId);
    const sessionLine: PiSessionLine = {
      type: "session",
      version: 3,
      id: piSessionId,
      timestamp: sessionIso,
      cwd: session.directory,
    };

    const lines = [sessionLine, ...messageLines].map((line) =>
      JSON.stringify(line),
    );

    if (shouldWrite) {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputFile, `${lines.join("\n")}\n`, "utf8");
      console.log(`Wrote ${outputFile}`);
    } else {
      console.log(
        `[dry-run] Would write ${outputFile} (${lines.length} lines)`,
      );
    }
  }
}

async function buildMessageLines(
  sessionId: string,
  parentSeed: string,
): Promise<PiMessageLine[]> {
  const messageDir = path.join(opencodeRoot, "message", sessionId);
  const messageFiles = await listJsonFiles(messageDir);
  const messages = await readAllJson<OpencodeMessage>(messageFiles);

  const sortedMessages = [...messages].sort(
    (a, b) => (a.time?.created ?? 0) - (b.time?.created ?? 0),
  );

  const lines: PiMessageLine[] = [];
  let previousId: string | null = null;

  for (const message of sortedMessages) {
    const content = await buildMessageContent(message.id);
    const createdAt = message.time?.created ?? Date.now();
    const timestamp = new Date(createdAt).toISOString();
    const messageId = crypto.randomUUID();

    const line: PiMessageLine = {
      type: "message",
      id: messageId,
      parentId: previousId,
      timestamp,
      message: {
        role: message.role,
        content,
        timestamp: createdAt,
      },
    };

    const errorMessage = message.error?.data?.message ?? message.error?.name;
    if (errorMessage) {
      line.message.errorMessage = errorMessage;
    }

    lines.push(line);
    previousId = messageId;
  }

  if (lines.length === 0) {
    return [];
  }

  if (lines[0]) {
    lines[0].parentId = parentSeed;
  }

  return lines;
}

async function buildMessageContent(
  messageId: string,
): Promise<{ type: "text"; text: string }[]> {
  const partDir = path.join(opencodeRoot, "part", messageId);
  const partFiles = await listJsonFiles(partDir);
  const parts = await readAllJson<OpencodePart>(partFiles);
  const sortedParts = [...parts].sort((a, b) => a.id.localeCompare(b.id));

  const content: { type: "text"; text: string }[] = [];

  for (const part of sortedParts) {
    const text = formatPartText(part);
    if (text) {
      content.push({ type: "text", text });
    }
  }

  return content;
}

function formatPartText(part: OpencodePart): string | null {
  switch (part.type) {
    case "text":
      return part.text?.trim() ? part.text : null;
    case "reasoning":
      return part.text?.trim() ? `Reasoning: ${part.text}` : null;
    case "tool":
      return formatToolPart(part);
    case "file":
      return formatFilePart(part);
    case "patch":
      return formatPatchPart(part);
    case "step-start":
      return part.snapshot ? `Step start (snapshot ${part.snapshot}).` : null;
    case "step-finish":
      return part.snapshot ? `Step finish (snapshot ${part.snapshot}).` : null;
    default:
      return `Part ${part.type}: ${safeJson(part)}`;
  }
}

function formatToolPart(part: OpencodePart): string | null {
  const state = part.state;
  const toolName = part.tool ?? "tool";
  const status = state?.status ?? "unknown";
  const title = state?.title ? ` ${state.title}` : "";
  const input = state?.input ? `Input: ${safeJson(state.input)}` : null;
  const outputText = state?.output ?? state?.metadata?.output;
  const output = outputText ? `Output: ${outputText}` : null;

  const lines = [`Tool ${toolName} (${status}).${title}`];
  if (input) {
    lines.push(input);
  }
  if (output) {
    lines.push(output);
  }

  return lines.join("\n");
}

function formatFilePart(part: OpencodePart): string | null {
  const filename = part.filename ?? part.source?.path ?? "unknown";
  const url = part.url ? ` (${part.url})` : "";
  const source = part.source?.text?.value
    ? ` Source: ${part.source.text.value}`
    : "";
  return `File: ${filename}${url}.${source}`;
}

function formatPatchPart(part: OpencodePart): string | null {
  const files = part.files?.length ? part.files.join(", ") : "unknown files";
  const hash = part.hash ? ` (hash ${part.hash})` : "";
  return `Patch applied to ${files}${hash}.`;
}

function toPiSessionDir(directory: string): string {
  const normalized = path.resolve(directory);
  const parts = normalized.split(path.sep).filter(Boolean);
  return `--${parts.join("-")}--`;
}

function formatTimestampForFilename(iso: string): string {
  return iso.replace(/:/g, "-").replace(/\./g, "-");
}

async function listSessionFiles(root: string): Promise<string[]> {
  const entries = await safeReadDir(root);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await listSessionFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await safeReadDir(dir);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function safeReadDir(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readAllJson<T>(files: string[]): Promise<T[]> {
  const items: T[] = [];
  for (const file of files) {
    items.push(await readJson<T>(file));
  }
  return items;
}

async function readJson<T>(filePath: string): Promise<T> {
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data) as T;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

await main();
