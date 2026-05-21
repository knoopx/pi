import { readFile } from "node:fs/promises";
import type { FileEntry } from "@earendil-works/pi-coding-agent";
import {
  emptyTimeFilteredStats,
  emptyProviderStats,
  emptyModelStats,
  accumulateStats,
} from "./types";
import type { UsageData, TabName } from "./types";
import { getAllSessionFiles } from "./session-files";
import {
  extractMessageFromEntry,
  type SessionMessage,
} from "./message-extraction";
export { getSessionsDir } from "./session-files";

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

function applyParseResult(
  result: { sessionId?: string; message?: SessionMessage },
  sessionId: string,
  _messages: SessionMessage[],
): string {
  return result.sessionId ?? sessionId;
}

function collectMessage(
  result: { message?: SessionMessage },
  messages: SessionMessage[],
): void {
  if (result.message) messages.push(result.message);
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
    await yieldIfNeeded(i);
    const result = parseSessionLine(lines[i], seenHashes);
    sessionId = applyParseResult(result, sessionId, messages);
    collectMessage(result, messages);
  }

  return sessionId ? { sessionId, messages } : null;
}

async function yieldIfNeeded(index: number): Promise<void> {
  if (index % 500 === 0)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
function parseJsonLine(line: string): unknown | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isSessionEntry(entry: {
  type?: string;
  id?: string;
}): entry is { type: "session"; id: string } {
  return entry.type === "session" && typeof entry.id === "string";
}

function isMessageEntry(entry: { type?: string; message?: unknown }): boolean {
  return entry.type === "message" && !!entry.message;
}

function parseMessageEntry(
  entry: { message?: unknown },
  seenHashes: Set<string>,
): { message?: SessionMessage } {
  const message = extractMessageFromEntry(entry as FileEntry, seenHashes);
  return message ? { message } : {};
}

function parseSessionLine(
  line: string,
  seenHashes: Set<string>,
): { sessionId?: string; message?: SessionMessage } {
  const raw = parseJsonLine(line);
  if (!raw) return {};

  const entry = raw as { type?: string; id?: string; message?: unknown };

  if (isSessionEntry(entry)) return { sessionId: entry.id };
  if (!isMessageEntry(entry)) return {};

  return parseMessageEntry(entry, seenHashes);
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
function getOrCreateProviderStats(
  stats: ReturnType<typeof emptyTimeFilteredStats>,
  provider: string,
): ReturnType<typeof emptyProviderStats> {
  let providerStats = stats.providers.get(provider);
  if (!providerStats) {
    providerStats = emptyProviderStats();
    stats.providers.set(provider, providerStats);
  }
  return providerStats;
}

function getOrCreateModelStats(
  providerStats: ReturnType<typeof emptyProviderStats>,
  model: string,
): ReturnType<typeof emptyModelStats> {
  let modelStats = providerStats.models.get(model);
  if (!modelStats) {
    modelStats = emptyModelStats();
    providerStats.models.set(model, modelStats);
  }
  return modelStats;
}

function accumulateForPeriod(
  stats: ReturnType<typeof emptyTimeFilteredStats>,
  msg: SessionMessage,
  sessionId: string,
  tokens: { total: number; input: number; output: number; cache: number },
): void {
  const providerStats = getOrCreateProviderStats(stats, msg.provider);
  const modelStats = getOrCreateModelStats(providerStats, msg.model);
  modelStats.sessions.add(sessionId);
  accumulateStats(modelStats, msg.cost, tokens);
  providerStats.sessions.add(sessionId);
  accumulateStats(providerStats, msg.cost, tokens);
  accumulateStats(stats.totals, msg.cost, tokens);
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
    const stats = opts.data[period];
    if (!stats || typeof stats !== "object") continue;
    accumulateForPeriod(stats, msg, opts.sessionId, tokens);
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
