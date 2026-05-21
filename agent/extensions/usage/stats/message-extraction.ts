import type { FileEntry, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";

export interface SessionMessage {
  provider: string;
  model: string;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  timestamp: number;
}

interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function validateEntry(
  entry: FileEntry,
): entry is Extract<SessionEntry, { type: "message" }> {
  return entry.type === "message";
}

function hasRoleAndProvider(m: {
  role?: string;
  provider?: string;
  model?: string;
}): boolean {
  return (
    m.role === "assistant" &&
    typeof m.provider === "string" &&
    typeof m.model === "string"
  );
}

function isValidUsage(usage: unknown): boolean {
  return typeof usage === "object" && usage !== null;
}

function hasRequiredMessageFields(m: {
  role?: string;
  usage?: unknown;
  provider?: string;
  model?: string;
}): boolean {
  if (!hasRoleAndProvider(m)) return false;
  return isValidUsage(m.usage);
}

function validateMessage(msg: unknown): msg is AssistantMessage {
  if (!msg || typeof msg !== "object") return false;
  return hasRequiredMessageFields(msg as Record<string, unknown>);
}

function extractValidMessage(entry: FileEntry): AssistantMessage | null {
  if (!validateEntry(entry)) return null;
  const msg = entry.message;
  if (!validateMessage(msg)) return null;
  return msg;
}

function buildSessionMessage(
  msg: AssistantMessage,
  usage: NonNullable<AssistantMessage["usage"]>,
  tokens: TokenUsage,
  timestamp: number,
): SessionMessage {
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

function toNumber(value: unknown): number {
  return Number(value) || 0;
}

function extractTokenCounts(usage: TokenUsage): {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
} {
  return {
    input: toNumber(usage.input),
    output: toNumber(usage.output),
    cacheRead: toNumber(usage.cacheRead),
    cacheWrite: toNumber(usage.cacheWrite),
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

export function extractMessageFromEntry(
  entry: FileEntry,
  seenHashes: Set<string>,
): SessionMessage | null {
  const msg = extractValidMessage(entry);
  if (!msg) return null;

  const { usage } = msg;
  const tokens = extractTokenCounts(usage);
  const timestamp = resolveTimestamp(entry, msg);

  if (isDuplicate(tokens, timestamp, seenHashes)) return null;
  markSeen(tokens, timestamp, seenHashes);
  return buildSessionMessage(msg, usage, tokens, timestamp);
}
