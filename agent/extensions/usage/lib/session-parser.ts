import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getSessionsDir } from "../stats/data-collection";

export interface UsageCall {
  name: string;
  sessionId: string;
  timestamp: string;
}

export interface BucketEntry {
  count: number;
  items: Record<string, number>;
}

export interface AggregatedStats {
  totalSessions: number;
  totalCalls: number;
  byItem: Record<string, number>;
  bySession: Record<string, BucketEntry>;
  byDate: Record<string, BucketEntry>;
}

export type CallExtractor = (
  contents: unknown[],
  sessionId: string,
  timestamp: number,
) => UsageCall[];

interface SessionEntry {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: { content?: unknown };
}

function extractSessionId(entry: SessionEntry): string | null {
  if (entry.type === "session" && typeof entry.id === "string") {
    return entry.id;
  }
  return null;
}

function isMessageWithContent(
  entry: SessionEntry,
  sessionId: string | null,
): entry is SessionEntry & {
  message: { content: unknown };
} {
  return (
    entry.type === "message" && !!entry.message?.content && sessionId !== null
  );
}

function normalizeContents(content: unknown): unknown[] {
  return Array.isArray(content) ? content : [content];
}

function parseTimestamp(timestamp: string | undefined): number {
  if (!timestamp) return 0;
  return new Date(timestamp).getTime();
}

function tryParseLine(line: string): SessionEntry | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line) as SessionEntry;
  } catch {
    return null;
  }
}

function parseSessionLine(
  line: string,
  sessionId: string | null,
  extractCalls: CallExtractor,
): { sessionId: string | null; calls: UsageCall[] } {
  const entry = tryParseLine(line);
  if (!entry) return { sessionId, calls: [] };

  const newSessionId = extractSessionId(entry);
  if (newSessionId !== null) {
    return { sessionId: newSessionId, calls: [] };
  }

  if (!isMessageWithContent(entry, sessionId)) {
    return { sessionId, calls: [] };
  }

  const contents = normalizeContents(entry.message.content);
  return {
    sessionId,
    calls: extractCalls(
      contents,
      sessionId as string,
      parseTimestamp(entry.timestamp),
    ),
  };
}

async function scanSessionDir(dirPath: string): Promise<string[]> {
  try {
    const files = await readdir(dirPath);
    return files
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => join(dirPath, f));
  } catch {
    return [];
  }
}

export async function findSessionFiles(sessionsDir: string): Promise<string[]> {
  try {
    const sessionDirs = await readdir(sessionsDir);
    const results: string[] = [];
    for (const dir of sessionDirs) {
      results.push(...(await scanSessionDir(join(sessionsDir, dir))));
    }
    return results;
  } catch {
    return [];
  }
}

async function parseSessionFile(
  filePath: string,
  extractCalls: CallExtractor,
): Promise<{ sessionId: string | null; calls: UsageCall[] }> {
  const content = await import("node:fs/promises").then((m) =>
    m.readFile(filePath, "utf-8"),
  );
  const lines = content.trim().split("\n");
  let sessionId: string | null = null;
  const calls: UsageCall[] = [];

  for (const line of lines) {
    const result = parseSessionLine(line, sessionId, extractCalls);
    sessionId = result.sessionId;
    calls.push(...result.calls);
  }
  return { sessionId, calls };
}

function incrementBucket(
  buckets: Record<string, BucketEntry>,
  key: string,
  itemName: string,
): void {
  if (!buckets[key]) buckets[key] = { count: 0, items: {} };
  buckets[key].count++;
  buckets[key].items[itemName] = (buckets[key].items[itemName] || 0) + 1;
}

export function aggregateStats(
  allCalls: UsageCall[],
  sessionCount: number,
): AggregatedStats {
  const stats: AggregatedStats = {
    totalSessions: sessionCount,
    totalCalls: allCalls.length,
    byItem: {},
    bySession: {},
    byDate: {},
  };

  for (const call of allCalls) {
    stats.byItem[call.name] = (stats.byItem[call.name] || 0) + 1;
    incrementBucket(stats.bySession, call.sessionId, call.name);
    const date = call.timestamp?.split("T")[0] || "unknown";
    incrementBucket(stats.byDate, date, call.name);
  }

  return stats;
}

export async function processSessionFiles(
  filePaths: string[],
  extractCalls: CallExtractor,
  signal?: AbortSignal,
): Promise<{ calls: UsageCall[]; sessionCount: number }> {
  const allCalls: UsageCall[] = [];
  let sessionCount = 0;

  for (const filePath of filePaths) {
    if (signal?.aborted) return { calls: allCalls, sessionCount };
    try {
      const { sessionId, calls } = await parseSessionFile(
        filePath,
        extractCalls,
      );
      if (sessionId) sessionCount++;
      allCalls.push(...calls);
    } catch {
      // Skip unreadable files
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return { calls: allCalls, sessionCount };
}

export { getSessionsDir };
