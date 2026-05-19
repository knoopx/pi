import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  HistoryEntry,
  SessionMessageLine,
  SessionLine,
  ProcessSessionFileOpts,
} from "../types";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function asSessionMessage(message: unknown): SessionMessageLine | null {
  if (typeof message !== "object" || message === null) return null;
  return message as SessionMessageLine;
}

function addHistoryEntry(
  history: HistoryEntry[],
  seen: Set<string>,
  entry: HistoryEntry,
): void {
  const content = entry.content.trim();
  if (!content) return;
  const key = `${entry.type}:${content}`;
  if (seen.has(key)) return;

  seen.add(key);
  const firstLine = content.split("\n")[0]?.trim() ?? content;
  history.push({ ...entry, content, preview: firstLine });
}

function extractBangCommandsFromUserText(text: string): string[] {
  const commands: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("!")) continue;
    const command = line.replace(/^!+/, "").trim();
    if (command) commands.push(command);
  }
  return commands;
}

function isNonNullObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function extractTextFromBlock(block: unknown): string {
  if (!isNonNullObject(block)) return "";
  const typed = block as { type?: unknown; text?: unknown };
  if (typed.type !== "text" || typeof typed.text !== "string") return "";
  return typed.text as string;
}

function getUserTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map(extractTextFromBlock)
    .filter((part) => part.length > 0)
    .join("\n")
    .trim();
}

function isPathMatch(sessionCwd: string, targetCwd: string): boolean {
  return (
    sessionCwd === targetCwd ||
    sessionCwd.startsWith(`${targetCwd}/`) ||
    targetCwd.startsWith(`${sessionCwd}/`)
  );
}

function tryParseSessionLine(
  line: string,
): { type: string; cwd?: string } | null {
  try {
    const parsed = JSON.parse(line) as { type?: string; cwd?: string };
    if (parsed && parsed.type === "session")
      return { type: parsed.type, cwd: parsed.cwd };
  } catch {
    // Not valid JSON — fallback below returns null
  }
  return null;
}

function parseSessionHeaderLine(line: string): string | null {
  const parsed = tryParseSessionLine(line);
  if (!parsed) return null;
  return parsed.cwd || null;
}

function getSessionCwd(content: string): string | null {
  for (const line of content.trim().split("\n")) {
    const cwd = parseSessionHeaderLine(line);
    if (cwd) return cwd;
  }
  return null;
}

function extractTimestamp(
  entry: SessionLine,
  message: SessionMessageLine,
): number {
  if (typeof entry.timestamp === "string")
    return new Date(entry.timestamp).getTime();
  if (typeof entry.timestamp === "number") return entry.timestamp;
  if (typeof message.timestamp === "number") return message.timestamp;
  return Date.now();
}

function processSessionFile(
  fullPath: string,
  opts: ProcessSessionFileOpts,
): void {
  try {
    const content = readFileSync(fullPath, "utf-8");
    if (!shouldProcessSession(content, opts.targetCwd)) return;
    for (const line of content.trim().split("\n")) {
      processSessionLine(line, opts);
    }
  } catch {
    // Graceful degradation: unreadable session file skipped silently
  }
}

function shouldProcessSession(content: string, targetCwd: string): boolean {
  const sessionCwd = getSessionCwd(content);
  if (!sessionCwd) return false;
  return isPathMatch(sessionCwd, targetCwd);
}

function parseMessageEntry(
  line: string,
): { entry: SessionLine; message: SessionMessageLine } | null {
  try {
    const entry = JSON.parse(line) as SessionLine;
    if (entry.type !== "message") return null;
    const message = asSessionMessage(entry.message);
    if (!message) return null;
    return { entry, message };
  } catch {
    return null;
  }
}

function processSessionLine(line: string, opts: ProcessSessionFileOpts): void {
  if (!line.trim()) return;
  const parsed = parseMessageEntry(line);
  if (!parsed) return;
  const timestamp = extractTimestamp(parsed.entry, parsed.message);
  if (timestamp < opts.cutoffTimestamp) return;
  processMessageEntry(parsed.message, timestamp, opts.history, opts.seen);
}

function processBashMessage(
  message: SessionMessageLine,
  timestamp: number,
  history: HistoryEntry[],
  seen: Set<string>,
): void {
  if (typeof message.command === "string") {
    addHistoryEntry(history, seen, {
      content: message.command,
      timestamp,
      type: "command",
    });
  }
}

function processUserMessage(
  message: SessionMessageLine,
  timestamp: number,
  history: HistoryEntry[],
  seen: Set<string>,
): void {
  const text = getUserTextFromContent(message.content);
  if (!text) return;
  addHistoryEntry(history, seen, {
    content: text,
    timestamp,
    type: "message",
  });
  for (const command of extractBangCommandsFromUserText(text)) {
    addHistoryEntry(history, seen, {
      content: command,
      timestamp,
      type: "command",
    });
  }
}

function processMessageEntry(
  message: SessionMessageLine,
  timestamp: number,
  history: HistoryEntry[],
  seen: Set<string>,
): void {
  switch (message.role) {
    case "bashExecution":
      processBashMessage(message, timestamp, history, seen);
      break;
    case "user":
      processUserMessage(message, timestamp, history, seen);
      break;
  }
}

function isRecentJsonlFile(
  fullPath: string,
  entry: string,
  cutoffMs: number,
): boolean {
  try {
    const stat = statSync(fullPath);
    if (!entry.endsWith(".jsonl")) return false;
    return stat.mtimeMs >= cutoffMs;
  } catch {
    return false;
  }
}

function processDirEntry(
  fullPath: string,
  entry: string,
  opts: ProcessSessionFileOpts,
): void {
  try {
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, opts);
      return;
    }
    if (isRecentJsonlFile(fullPath, entry, opts.cutoffTimestamp)) {
      processSessionFile(fullPath, opts);
    }
  } catch {
    // Graceful degradation: directory stat failure, skip entry
  }
}

function walkDir(dir: string, opts: ProcessSessionFileOpts): void {
  try {
    for (const entry of readdirSync(dir)) {
      processDirEntry(join(dir, entry), entry, opts);
    }
  } catch {
    // Graceful degradation: cannot read session directory
  }
}

export function loadSessionHistoryForCwd(targetCwd: string): HistoryEntry[] {
  const history: HistoryEntry[] = [];
  const seen = new Set<string>();
  const cutoffTimestamp = Date.now() - ONE_WEEK_MS;

  try {
    const sessionsDir = join(homedir(), ".pi", "agent", "sessions");
    walkDir(sessionsDir, { targetCwd, cutoffTimestamp, history, seen });
  } catch {
    // Graceful degradation: sessions directory inaccessible
  }

  return history.sort((a, b) => b.timestamp - a.timestamp);
}
