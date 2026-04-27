import type {
  ExtensionAPI,
  ExtensionContext,
  TurnStartEvent,
  TurnEndEvent,
  AgentEndEvent,
} from "@mariozechner/pi-coding-agent";
import type { Usage } from "@mariozechner/pi-ai";

// Message event types are not exported from pi's public API but are accepted
// by pi.on() at runtime. Define them locally to match the internal types.
interface MessageStartEvent {
  type: "message_start";
  message: unknown;
}

interface MessageUpdateEvent {
  type: "message_update";
  message: unknown;
}

interface MessageEndEvent {
  type: "message_end";
  message: unknown;
}

const STALL_THRESHOLD_MS = 500;

export function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0)
    return `${String(hours)}h ${String(minutes)}m ${String(Math.floor(seconds))}s`;
  if (minutes > 0) return `${String(minutes)}m ${String(Math.floor(seconds))}s`;
  if (seconds < 1) return `${seconds.toFixed(2)}s`;
  return `${String(Math.floor(seconds))}s`;
}

export function formatTokens(tokens: number | undefined | null): string {
  if (tokens === undefined || tokens === null) return "N/A";
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

export function formatInputOutputTokens(
  input: number | undefined,
  output: number | undefined,
  _cacheRead: number | undefined,
  _cacheWrite: number | undefined,
): string {
  const inputStr = formatTokens(input);
  const outputStr = formatTokens(output);
  const directionStr = `↑${inputStr} ↓${outputStr}`;

  if (inputStr === "N/A" && outputStr === "N/A") return "";

  return directionStr;
}

export function formatCost(usage: Usage | undefined | null): string {
  if (!usage) return "";
  const { total } = usage.cost;
  if (total < 0.005) return "";
  return `$${total.toFixed(2)}`;
}

export function formatTokensPerSecond(
  tokens: number | undefined,
  generationMs: number | undefined,
): string {
  if (tokens === undefined || generationMs === undefined || generationMs <= 0)
    return "";
  const tokensPerSecond = tokens / (generationMs / 1000);
  return `${tokensPerSecond.toFixed(1)} tok/s`;
}

export interface AgentRunStats {
  turns: number;
  totalOutputTokens: number;
  totalInputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalTokens: number;
  totalCost: Usage["cost"];
  totalGenerationMs: number;
}

export function formatAggregateOutput(
  stats: AgentRunStats,
  durationMs: number,
): string {
  const turnsStr = `󰍩 ${stats.turns} ${stats.turns === 1 ? "turn" : "turns"}`;
  const tokensStr = formatInputOutputTokens(
    stats.totalInputTokens,
    stats.totalOutputTokens,
    undefined,
    undefined,
  );
  const durationStr = formatDuration(durationMs);
  const tokPerSecStr = formatTokensPerSecond(
    stats.totalOutputTokens,
    stats.totalGenerationMs,
  );
  const costStr =
    stats.totalCost.total < 0.005 ? "" : `$${stats.totalCost.total.toFixed(2)}`;

  const parts = [turnsStr];
  if (tokensStr) parts.push(tokensStr);
  parts.push(` ${durationStr}`);
  if (tokPerSecStr) parts.push(` ${tokPerSecStr}`);
  if (costStr) parts.push(costStr);

  return parts.join(" · ");
}

export function formatSimpleOutput(
  output: number | undefined,
  durationMs: number,
  usage: Usage | undefined,
  generationMs?: number,
): string {
  const outputStr = formatTokens(output);
  const durationStr = formatDuration(durationMs);
  const tokPerSecStr = formatTokensPerSecond(output, generationMs);
  const costStr = formatCost(usage);

  let result = `↓${outputStr} |  ${durationStr}`;
  if (tokPerSecStr) result += ` |  ${tokPerSecStr}`;
  if (costStr) result += ` | ${costStr}`;
  return result;
}

interface TurnTiming {
  turnStartMs: number;
  lastUpdateMs: number;
  firstTokenMs: number | null;
  currentMessageStartMs: number | null;
  totalGenerationMs: number;
  stallMs: number;
  stallCount: number;
  inStall: boolean;
}

function isAssistantMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const msg = message as Record<string, unknown>;
  if (msg.role !== "assistant") return false;
  if (typeof msg.usage !== "object" || msg.usage === null) return false;
  return true;
}

function createTurnStartHandler(currentTiming: {
  value: TurnTiming | null;
}): (event: TurnStartEvent) => void {
  return (event: TurnStartEvent) => {
    currentTiming.value = {
      turnStartMs: event.timestamp,
      lastUpdateMs: event.timestamp,
      firstTokenMs: null,
      currentMessageStartMs: null,
      totalGenerationMs: 0,
      stallMs: 0,
      stallCount: 0,
      inStall: false,
    };
  };
}

function createMessageStartHandler(currentTiming: {
  value: TurnTiming | null;
}): (event: MessageStartEvent) => void {
  return (event: MessageStartEvent) => {
    if (!currentTiming.value) return;
    if (!isAssistantMessage(event.message)) return;

    const now = Date.now();
    const timing = currentTiming.value;

    // Track when THIS message started streaming (for generation TPS)
    timing.currentMessageStartMs = now;

    // messages don't get counted as inference stalls.
    timing.lastUpdateMs = now;
    timing.inStall = false;
  };
}

function createMessageUpdateHandler(currentTiming: {
  value: TurnTiming | null;
}): (event: MessageUpdateEvent) => void {
  return (event: MessageUpdateEvent) => {
    if (!currentTiming.value) return;
    if (!isAssistantMessage(event.message)) return;

    const timing = currentTiming.value;
    const now = Date.now();

    // First token: capture TTFT and seed stall timing, then bail.
    // No stall detection on this event — the gap from message_start to
    // first message_update is provider parsing overhead, not a stall.
    if (timing.firstTokenMs === null) {
      timing.firstTokenMs = now;
      timing.lastUpdateMs = now;
      return;
    }

    const gap = now - timing.lastUpdateMs;

    // time — the threshold is a detection gate, not a duration discount.
    if (gap >= STALL_THRESHOLD_MS) {
      if (!timing.inStall) {
        timing.stallCount++;
      }
      timing.inStall = true;
      timing.stallMs += gap;
    } else {
      timing.inStall = false;
    }

    timing.lastUpdateMs = now;
  };
}

function createMessageEndHandler(currentTiming: {
  value: TurnTiming | null;
}): (event: MessageEndEvent) => void {
  return (event: MessageEndEvent) => {
    if (!currentTiming.value) return;
    if (!isAssistantMessage(event.message)) return;

    const timing = currentTiming.value;
    const now = Date.now();

    // Accumulate ACTUAL streaming time for this message (true generation time)
    if (timing.currentMessageStartMs) {
      const messageGenerationMs = now - timing.currentMessageStartMs;
      timing.totalGenerationMs += messageGenerationMs;
      timing.currentMessageStartMs = null;
    }

    timing.lastUpdateMs = now;
  };
}

function createTurnEndHandler(
  currentTiming: { value: TurnTiming | null },
  agentState: {
    lastTurnEndTimestamp?: number | null;
    totalGenerationMs?: number;
  },
) {
  return (event: TurnEndEvent, ctx: ExtensionContext): void => {
    const timing = currentTiming.value;
    currentTiming.value = null;

    if (!timing) return;
    if (event.message.role !== "assistant") return;

    const turnEndTimestamp = Date.now();
    agentState.lastTurnEndTimestamp = turnEndTimestamp;

    const durationMs = Math.max(0, turnEndTimestamp - timing.turnStartMs);
    const generationMs =
      timing.totalGenerationMs > 0 ? timing.totalGenerationMs : undefined;

    // Accumulate generation time for session-level stats
    agentState.totalGenerationMs =
      (agentState.totalGenerationMs ?? 0) + timing.totalGenerationMs;

    const notificationStr = formatSimpleOutput(
      event.message.usage.output,
      durationMs,
      event.message.usage,
      generationMs,
    );
    ctx.ui.notify(notificationStr, "info");
  };
}

function computeAgentRunStats(messages: AgentEndEvent["messages"]): {
  turns: number;
  totalOutputTokens: number;
  totalInputTokens: number;
  totalCost: Usage["cost"];
} | null {
  let turns = 0;
  let totalOutputTokens = 0;
  let totalInputTokens = 0;
  const totalCost: Usage["cost"] = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  };

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    turns++;
    const { usage } = message;
    totalOutputTokens += usage.output;
    totalInputTokens += usage.input;
    totalCost.input += usage.cost.input;
    totalCost.output += usage.cost.output;
    totalCost.cacheRead += usage.cost.cacheRead;
    totalCost.cacheWrite += usage.cost.cacheWrite;
    totalCost.total += usage.cost.total;
  }

  if (turns === 0) return null;

  return { turns, totalOutputTokens, totalInputTokens, totalCost };
}

function createAgentEndHandler(agentState: {
  agentStartTime: number | null;
  lastTurnEndTimestamp?: number | null;
  totalGenerationMs?: number;
}) {
  return (event: AgentEndEvent, ctx: ExtensionContext): void => {
    if (agentState.agentStartTime === null) return;

    const endTimestamp = agentState.lastTurnEndTimestamp ?? Date.now();
    const totalDurationMs = endTimestamp - agentState.agentStartTime;

    const stats = computeAgentRunStats(event.messages);
    if (!stats) return;

    const agentRunStats: AgentRunStats = {
      ...stats,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
      totalGenerationMs: agentState.totalGenerationMs ?? 0,
    };

    const notificationStr = formatAggregateOutput(
      agentRunStats,
      totalDurationMs,
    );
    if (ctx.hasUI) ctx.ui.notify(notificationStr, "info");
  };
}

function createAgentStartHandler(state: {
  agentStartTime: number | null;
}): () => void {
  return () => {
    state.agentStartTime ??= Date.now();
  };
}

function createSessionHandlers(
  currentTiming: { value: TurnTiming | null },
  agentState: { totalGenerationMs?: number },
) {
  function resetCounters(): void {
    currentTiming.value = null;
    agentState.totalGenerationMs = undefined;
  }

  return {
    onSessionStart() {
      resetCounters();
    },
    onSessionShutdown() {
      resetCounters();
    },
  };
}

export default function (pi: ExtensionAPI): void {
  const currentTiming = { value: null as TurnTiming | null };
  const agentState = {
    agentStartTime: null as number | null,
    lastTurnEndTimestamp: undefined as number | null | undefined,
    totalGenerationMs: undefined as number | undefined,
  };

  pi.on("turn_start", createTurnStartHandler(currentTiming));
  pi.on("message_start", createMessageStartHandler(currentTiming));
  pi.on("message_update", createMessageUpdateHandler(currentTiming));
  pi.on("message_end", createMessageEndHandler(currentTiming));
  pi.on("turn_end", createTurnEndHandler(currentTiming, agentState));
  pi.on("agent_start", createAgentStartHandler(agentState));
  pi.on("agent_end", createAgentEndHandler(agentState));

  const sessionHandlers = createSessionHandlers(currentTiming, agentState);
  pi.on("session_start", sessionHandlers.onSessionStart);
  pi.on("session_shutdown", sessionHandlers.onSessionShutdown);
}
