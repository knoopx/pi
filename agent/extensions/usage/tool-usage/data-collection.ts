import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getSessionsDir } from "../usage/data-collection";
import type { ToolCall, ToolStats } from "./types";

async function collectToolSessionFiles(
  dirPath: string,
  dir: string,
): Promise<{ dir: string; file: string }[]> {
  const result: { dir: string; file: string }[] = [];
  try {
    const files = await readdir(dirPath);
    for (const file of files) {
      if (file.endsWith(".jsonl"))
        result.push({ dir, file: join(dirPath, file) });
    }
  } catch {
    // Skip non-directories
  }
  return result;
}

async function findToolSessionFiles(
  sessionsDir: string,
): Promise<{ dir: string; file: string }[]> {
  const results: { dir: string; file: string }[] = [];
  try {
    const sessionDirs = await readdir(sessionsDir);
    for (const dir of sessionDirs) {
      if (dir === "subagents") continue;
      const dirPath = join(sessionsDir, dir);
      const files = await collectToolSessionFiles(dirPath, dir);
      results.push(...files);
    }
  } catch {
    // Skip directories we can't read
  }
  return results;
}

function collectToolCallsFromContents(
  contents: unknown[],
  sessionId: string,
  timestamp: number,
): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  for (const content of contents) {
    if (
      (content as { type?: string; name?: string })?.type === "toolCall" &&
      (content as { name?: string }).name
    ) {
      toolCalls.push({
        name: (content as { name: string }).name,
        sessionId,
        timestamp: String(timestamp),
      });
    }
  }
  return toolCalls;
}

function parseSessionEntry(
  line: string,
  sessionId: string | null,
): { sessionId: string | null; toolCalls: ToolCall[] } {
  if (!line.trim()) return { sessionId, toolCalls: [] };
  try {
    const entry = JSON.parse(line) as SessionEntry;

    if (entry.type === "session" && typeof entry.id === "string") {
      return { sessionId: entry.id, toolCalls: [] };
    }

    if (
      entry.type !== "message" ||
      !entry.message?.content ||
      sessionId === null
    ) {
      return { sessionId, toolCalls: [] };
    }

    const contents = normalizeContents(entry.message.content);
    return {
      sessionId,
      toolCalls: collectToolCallsFromContents(
        contents,
        sessionId,
        parseTimestamp(entry.timestamp),
      ),
    };
  } catch {
    // Skip malformed lines
  }
  return { sessionId, toolCalls: [] };
}

interface SessionEntry {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: { content?: unknown };
}

function normalizeContents(content: unknown): unknown[] {
  return Array.isArray(content) ? content : [content];
}

function parseTimestamp(timestamp: string | undefined): number {
  if (!timestamp) return 0;
  return new Date(timestamp).getTime();
}

async function parseToolSession(
  filePath: string,
): Promise<{ sessionId: string | null; toolCalls: ToolCall[] }> {
  const content = await import("node:fs/promises").then((m) =>
    m.readFile(filePath, "utf-8"),
  );
  const lines = content.trim().split("\n");
  let sessionId: string | null = null;
  const toolCalls: ToolCall[] = [];

  for (const line of lines) {
    const result = parseSessionEntry(line, sessionId);
    sessionId = result.sessionId;
    toolCalls.push(...result.toolCalls);
  }
  return { sessionId, toolCalls };
}

function aggregateToolStats(
  allToolCalls: ToolCall[],
  sessionCount: number,
): ToolStats {
  const stats: ToolStats = {
    totalSessions: sessionCount,
    totalToolCalls: allToolCalls.length,
    byTool: {},
    bySession: {},
    byDate: {},
  };

  for (const call of allToolCalls) {
    stats.byTool[call.name] = (stats.byTool[call.name] || 0) + 1;

    if (!stats.bySession[call.sessionId])
      stats.bySession[call.sessionId] = { count: 0, tools: {} };
    stats.bySession[call.sessionId].count++;
    stats.bySession[call.sessionId].tools[call.name] =
      (stats.bySession[call.sessionId].tools[call.name] || 0) + 1;

    const date = call.timestamp?.split("T")[0] || "unknown";
    if (!stats.byDate[date]) stats.byDate[date] = { count: 0, tools: {} };
    stats.byDate[date].count++;
    stats.byDate[date].tools[call.name] =
      (stats.byDate[date].tools[call.name] || 0) + 1;
  }

  return stats;
}

export async function collectToolStats(
  signal?: AbortSignal,
): Promise<ToolStats | null> {
  const sessionsDir = getSessionsDir();
  const sessionFiles = await findToolSessionFiles(sessionsDir);
  if (signal?.aborted) return null;

  const allToolCalls: ToolCall[] = [];
  let sessionCount = 0;

  for (const { file } of sessionFiles) {
    if (signal?.aborted) return null;
    try {
      const { sessionId, toolCalls } = await parseToolSession(file);
      if (sessionId) sessionCount++;
      allToolCalls.push(...toolCalls);
    } catch {
      // Skip files that can't be parsed
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return aggregateToolStats(allToolCalls, sessionCount);
}
