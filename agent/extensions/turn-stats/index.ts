import type {
  ExtensionAPI,
  ExtensionContext,
  TurnStartEvent,
  TurnEndEvent,
  AgentEndEvent,
} from "@mariozechner/pi-coding-agent";
import type { Usage } from "@mariozechner/pi-ai";

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

export interface AggregateStats {
  turns: number;
  totalOutputTokens: number;
  totalInputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalTokens: number;
  totalCost: Usage["cost"];
}

export function formatAggregateOutput(
  stats: AggregateStats,
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
  const costStr =
    stats.totalCost.total < 0.005 ? "" : `$${stats.totalCost.total.toFixed(2)}`;

  const parts = [turnsStr];
  if (tokensStr) parts.push(tokensStr);
  parts.push(` ${durationStr}`);
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

function createTurnStartHandler(
  turnStartTimes: Map<number, number>,
): (event: TurnStartEvent) => void {
  return (event: TurnStartEvent) => {
    turnStartTimes.set(event.turnIndex, Date.now());
  };
}

function createTurnEndHandler(
  turnStartTimes: Map<number, number>,
  agentState: { lastTurnEndTimestamp?: number | null },
) {
  return (event: TurnEndEvent, ctx: ExtensionContext): void => {
    const { turnIndex } = event;
    const startTime = turnStartTimes.get(turnIndex);
    turnStartTimes.delete(turnIndex);

    if (event.message.role !== "assistant") return;

    const turnEndTimestamp = Date.now();
    agentState.lastTurnEndTimestamp = turnEndTimestamp;

    const durationMs =
      startTime !== undefined ? Math.max(0, turnEndTimestamp - startTime) : 0;

    const notificationStr = formatSimpleOutput(
      event.message.usage.output,
      durationMs,
      event.message.usage,
    );
    ctx.ui.notify(notificationStr, "info");
  };
}

function computeAggregateStats(messages: AgentEndEvent["messages"]): {
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
}) {
  return (event: AgentEndEvent, ctx: ExtensionContext): void => {
    if (agentState.agentStartTime === null) return;

    const endTimestamp = agentState.lastTurnEndTimestamp ?? Date.now();
    const totalDurationMs = endTimestamp - agentState.agentStartTime;

    const stats = computeAggregateStats(event.messages);
    if (!stats) return;

    const aggregate: AggregateStats = {
      ...stats,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
    };

    const notificationStr = formatAggregateOutput(aggregate, totalDurationMs);
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

function createSessionHandlers(turnStartTimes: Map<number, number>) {
  function resetCounters(): void {
    turnStartTimes.clear();
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
  const turnStartTimes = new Map<number, number>();
  const agentState = {
    agentStartTime: null as number | null,
    lastTurnEndTimestamp: undefined as number | null | undefined,
  };

  pi.on("turn_start", createTurnStartHandler(turnStartTimes));
  pi.on("turn_end", createTurnEndHandler(turnStartTimes, agentState));
  pi.on("agent_start", createAgentStartHandler(agentState));
  pi.on("agent_end", createAgentEndHandler(agentState));

  const sessionHandlers = createSessionHandlers(turnStartTimes);
  pi.on("session_start", sessionHandlers.onSessionStart);
  pi.on("session_shutdown", sessionHandlers.onSessionShutdown);
}
