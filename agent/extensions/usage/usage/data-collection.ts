import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { FileEntry, SessionEntry } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import {
  emptyTimeFilteredStats,
  emptyProviderStats,
  emptyModelStats,
  accumulateStats,
} from "./types";
import type { UsageData, TabName } from "./types";

export function getSessionsDir(): string {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "sessions");
}

async function getAllSessionFiles(signal?: AbortSignal): Promise<string[]> {
  const sessionsDir = getSessionsDir();
  async function collectSessionFiles(
    cwdPath: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const result: string[] = [];
    try {
      const sessionFiles = await readdir(cwdPath);
      for (const file of sessionFiles) {
        if (signal?.aborted) return result;
        if (file.endsWith(".jsonl")) result.push(join(cwdPath, file));
      }
    } catch {
      // Skip directories we can't read
    }
    return result;
  }

  const files: string[] = [];

  try {
    const cwdDirs = await readdir(sessionsDir, { withFileTypes: true });
    for (const dir of cwdDirs) {
      if (signal?.aborted) return files;
      if (!dir.isDirectory()) continue;
      const cwdPath = join(sessionsDir, dir.name);
      const sessionFiles = await collectSessionFiles(cwdPath, signal);
      files.push(...sessionFiles);
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

interface SessionMessage {
  provider: string;
  model: string;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  timestamp: number;
}

function validateEntry(
  entry: FileEntry,
): entry is Extract<SessionEntry, { type: "message" }> {
  return entry.type === "message";
}

function validateMessage(msg: unknown): msg is AssistantMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return (
    m.role === "assistant" &&
    typeof m.usage === "object" &&
    m.usage !== null &&
    typeof m.provider === "string" &&
    typeof m.model === "string"
  );
}

function extractMessageFromEntry(
  entry: FileEntry,
  seenHashes: Set<string>,
): SessionMessage | null {
  if (!validateEntry(entry)) return null;
  const msg = entry.message;
  if (!validateMessage(msg)) return null;

  const { usage } = msg;
  const tokens = extractTokenCounts(
    usage as unknown as Record<string, unknown>,
  );
  const timestamp = resolveTimestamp(entry, msg);

  if (isDuplicate(tokens, timestamp, seenHashes)) return null;
  markSeen(tokens, timestamp, seenHashes);

  return {
    provider: msg.provider,
    model: msg.model,
    cost: usage.cost.total || 0,
    input: tokens.input,
    output: tokens.output,
    cacheRead: tokens.cacheRead,
    cacheWrite: tokens.cacheWrite,
    timestamp,
  };
}

function extractTokenCounts(usage: Record<string, unknown>): {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
} {
  return {
    input: Number(usage.input) || 0,
    output: Number(usage.output) || 0,
    cacheRead: Number(usage.cacheRead) || 0,
    cacheWrite: Number(usage.cacheWrite) || 0,
  };
}

function resolveTimestamp(entry: FileEntry, msg: AssistantMessage): number {
  const msgTs = Number(msg.timestamp);
  if (msgTs) return msgTs;
  if (!entry.timestamp) return 0;
  const fallbackTs = new Date(entry.timestamp).getTime();
  return Number.isNaN(fallbackTs) ? 0 : fallbackTs;
}

function isDuplicate(
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  },
  timestamp: number,
  seenHashes: Set<string>,
): boolean {
  const totalTokens =
    tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
  return seenHashes.has(`${timestamp}:${totalTokens}`);
}

function markSeen(
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  },
  timestamp: number,
  seenHashes: Set<string>,
): void {
  const totalTokens =
    tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
  seenHashes.add(`${timestamp}:${totalTokens}`);
}

async function parseSessionFile(
  filePath: string,
  seenHashes: Set<string>,
  signal?: AbortSignal,
): Promise<{ sessionId: string; messages: SessionMessage[] } | null> {
  try {
    const content = await readFile(filePath, "utf8");
    if (checkSignalAborted(signal)) return null;
    const lines = content.trim().split("\n");
    const result = await parseSessionLines(lines, seenHashes, signal);
    return result;
  } catch {
    return null;
  }
}

async function parseSessionLines(
  lines: string[],
  seenHashes: Set<string>,
  signal?: AbortSignal,
): Promise<{ sessionId: string; messages: SessionMessage[] } | null> {
  const messages: SessionMessage[] = [];
  let sessionId = "";

  for (let i = 0; i < lines.length; i++) {
    if (checkSignalAborted(signal)) return null;
    if (i % 500 === 0)
      await new Promise<void>((resolve) => setImmediate(resolve));
    const result = await parseSessionLine(lines[i], seenHashes);
    if (result.sessionId) sessionId = result.sessionId;
    if (result.message) messages.push(result.message);
  }

  return sessionId ? { sessionId, messages } : null;
}

function parseSessionLine(
  line: string,
  seenHashes: Set<string>,
): { sessionId?: string; message?: SessionMessage } {
  if (!line.trim()) return {};
  try {
    const raw = JSON.parse(line) as unknown;
    const entry = raw as { type?: string; id?: string };
    if (entry.type === "session" && typeof entry.id === "string")
      return { sessionId: entry.id, message: undefined };
    const messageEntry = raw as {
      type?: string;
      id?: string;
      message?: unknown;
    };
    if (messageEntry.type !== "message" || !messageEntry.message) return {};
    const message = extractMessageFromEntry(
      messageEntry as FileEntry,
      seenHashes,
    );
    if (message) return { message };
  } catch {
    // Skip malformed lines
  }
  return {};
}

function checkSignalAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function calculateTimeBoundaries(): { todayMs: number; weekStartMs: number } {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const startOfWeek = new Date();
  const dayOfWeek = startOfWeek.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const weekStartMs = startOfWeek.getTime();

  return { todayMs, weekStartMs };
}

function createEmptyUsageData(): UsageData {
  return {
    today: emptyTimeFilteredStats(),
    thisWeek: emptyTimeFilteredStats(),
    allTime: emptyTimeFilteredStats(),
  };
}

function getTimePeriods(
  timestamp: number,
  todayMs: number,
  weekStartMs: number,
): TabName[] {
  const periods: TabName[] = ["allTime"];
  if (timestamp >= todayMs) periods.push("today");
  if (timestamp >= weekStartMs) periods.push("thisWeek");
  return periods;
}

function processMessage(
  msg: SessionMessage,
  opts: {
    sessionId: string;
    data: UsageData;
    todayMs: number;
    weekStartMs: number;
  },
): { today: boolean; thisWeek: boolean; allTime: boolean } {
  const periods = getTimePeriods(msg.timestamp, opts.todayMs, opts.weekStartMs);
  const tokens = {
    total: msg.input + msg.output,
    input: msg.input,
    output: msg.output,
    cache: msg.cacheRead + msg.cacheWrite,
  };
  const sessionContributed = { today: false, thisWeek: false, allTime: false };

  for (const period of periods) {
    const raw = opts.data[period];
    if (!raw || typeof raw !== "object" || raw === null) continue;
    const stats = raw;
    let providerStats = stats.providers.get(msg.provider);
    if (!providerStats) {
      providerStats = emptyProviderStats();
      stats.providers.set(msg.provider, providerStats);
    }
    let modelStats = providerStats.models.get(msg.model);
    if (!modelStats) {
      modelStats = emptyModelStats();
      providerStats.models.set(msg.model, modelStats);
    }
    modelStats.sessions.add(opts.sessionId);
    accumulateStats(modelStats, msg.cost, tokens);
    providerStats.sessions.add(opts.sessionId);
    accumulateStats(providerStats, msg.cost, tokens);
    accumulateStats(stats.totals, msg.cost, tokens);
    sessionContributed[period] = true;
  }
  return sessionContributed;
}

async function processSessionFile(
  filePath: string,
  opts: {
    seenHashes: Set<string>;
    data: UsageData;
    todayMs: number;
    weekStartMs: number;
  },
  signal?: AbortSignal,
): Promise<void> {
  if (checkSignalAborted(signal)) return;
  const parsed = await parseSessionFile(filePath, opts.seenHashes, signal);
  if (!parsed) return;

  const contributed = aggregateSessionContributions(parsed, opts, signal);
  updateSessionCounts(opts.data, contributed);
}

function aggregateSessionContributions(
  parsed: { sessionId: string; messages: SessionMessage[] },
  opts: {
    data: UsageData;
    todayMs: number;
    weekStartMs: number;
  },
  signal?: AbortSignal,
): { today: boolean; thisWeek: boolean; allTime: boolean } {
  const { sessionId, messages } = parsed;
  const contributed = { today: false, thisWeek: false, allTime: false };

  for (const msg of messages) {
    if (checkSignalAborted(signal)) return contributed;
    const msgContributed = processMessage(msg, {
      sessionId,
      data: opts.data,
      todayMs: opts.todayMs,
      weekStartMs: opts.weekStartMs,
    });
    mergeContributions(contributed, msgContributed);
  }

  return contributed;
}

function mergeContributions(
  target: { today: boolean; thisWeek: boolean; allTime: boolean },
  source: { today: boolean; thisWeek: boolean; allTime: boolean },
): void {
  if (source.today) target.today = true;
  if (source.thisWeek) target.thisWeek = true;
  if (source.allTime) target.allTime = true;
}

function updateSessionCounts(
  data: UsageData,
  contributed: { today: boolean; thisWeek: boolean; allTime: boolean },
): void {
  if (contributed.today) data.today.totals.sessions++;
  if (contributed.thisWeek) data.thisWeek.totals.sessions++;
  if (contributed.allTime) data.allTime.totals.sessions++;
}

export async function collectUsageData(
  signal?: AbortSignal,
): Promise<UsageData | null> {
  const { todayMs, weekStartMs } = calculateTimeBoundaries();
  const data = createEmptyUsageData();

  const sessionFiles = await getAllSessionFiles(signal);
  if (checkSignalAborted(signal)) return null;
  const seenHashes = new Set<string>();

  for (const filePath of sessionFiles) {
    await processSessionFile(
      filePath,
      { seenHashes, data, todayMs, weekStartMs },
      signal,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return data;
}
