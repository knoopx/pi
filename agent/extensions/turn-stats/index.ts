import type {
  ExtensionAPI,
  ExtensionContext,
  AgentStartEvent,
  AgentEndEvent,
  TurnStartEvent,
  TurnEndEvent,
  SessionStartEvent,
  SessionShutdownEvent,
} from "@mariozechner/pi-coding-agent";
import type { AssistantMessageEvent } from "@mariozechner/pi-ai";

/** Local type for message_update event (not exported from pi-coding-agent) */
interface MessageUpdateEvent {
  type: "message_update";
  assistantMessageEvent: AssistantMessageEvent;
}

/**
 * Turn Stats Extension for Pi coding agent.
 * Tracks and reports duration and token usage for each turn.
 *
 * Features:
 * - Tracks duration of each turn
 * - Tracks token usage per turn (input, output, cacheRead, cacheWrite, totalTokens)
 * - Tracks cost breakdown per turn (input, output, cacheRead, cacheWrite, total)
 * - Shows both per-turn duration and agent end duration
 */

/**
 * Export formatting functions for testing
 */

/**
 * Get formatted duration string
 * @param ms Duration in milliseconds
 * @returns Formatted duration string (e.g., "0.36s", "36s", "1m 32s", "1h 2m 30s", "2h 15m 30s")
 */
export function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}m ${String(Math.floor(seconds))}s`;
  }
  if (minutes > 0) {
    return `${String(minutes)}m ${String(Math.floor(seconds))}s`;
  }
  // If seconds is less than 1, show decimal places
  if (seconds < 1) {
    return `${seconds.toFixed(2)}s`;
  }
  return `${String(Math.floor(seconds))}s`;
}

export function formatTokens(tokens: number | undefined | null): string {
  if (tokens === undefined || tokens === null) {
    return "N/A";
  }
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function formatInputOutputTokens(
  input: number | undefined,
  output: number | undefined,
  _cacheRead: number | undefined,
  _cacheWrite: number | undefined,
): string {
  // Calculate direction based on which side has tokens
  const inputStr = formatTokens(input);
  const outputStr = formatTokens(output);

  // Use arrows to indicate direction - input uses ↑, output uses ↓
  const directionStr = `↑${inputStr} ↓${outputStr}`;

  // If both input and output are undefined or N/A, return empty string
  if (inputStr === "N/A" && outputStr === "N/A") {
    return "";
  }

  return directionStr;
}

export function formatCost(
  cost:
    | {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
        total?: number;
      }
    | undefined
    | null,
): string {
  // If cost is undefined or null, return empty string
  if (!cost) {
    return "";
  }

  // Calculate total from cost.total or sum of components
  const total =
    cost.total ??
    (cost.input ?? 0) +
      (cost.output ?? 0) +
      (cost.cacheRead ?? 0) +
      (cost.cacheWrite ?? 0);

  // Don't show cost if it rounds to $0.00
  if (total < 0.005) {
    return "";
  }
  return `$${total.toFixed(2)}`;
}

/**
 * Format tokens per second
 * @param tokens Output tokens
 * @param generationMs Generation time in milliseconds (from first to last token)
 * @returns Formatted tokens/s string (e.g., "52.3 tok/s") or empty if unavailable
 */
export function formatTokensPerSecond(
  tokens: number | undefined,
  generationMs: number | undefined,
): string {
  if (tokens === undefined || generationMs === undefined || generationMs <= 0) {
    return "";
  }
  const tokensPerSecond = tokens / (generationMs / 1000);
  return `${tokensPerSecond.toFixed(1)} tok/s`;
}

/**
 * Format for output tokens, duration, tokens/s, and cost
 * Format: ↓<output_tokens> | <duration> | <tok/s> | <cost>
 * Example: ↓1.9K | 36s | 52.3 tok/s | $0.01 (without cost if 0)
 */
export function formatSimpleOutput(
  output: number | undefined,
  durationMs: number,
  cost:
    | {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
        total?: number;
      }
    | undefined,
  generationMs?: number,
): string {
  const outputStr = formatTokens(output);
  const durationStr = formatDuration(durationMs);
  const tokPerSecStr = formatTokensPerSecond(output, generationMs);
  const costStr = formatCost(cost);

  // Build the output string with separators between metrics
  let result = `↓${outputStr} | ${durationStr}`;
  if (tokPerSecStr) {
    result += ` | ${tokPerSecStr}`;
  }
  if (costStr) {
    result += ` | ${costStr}`;
  }
  return result;
}

function getTurnKey(turnIndex: unknown): string {
  if (typeof turnIndex === "number" || typeof turnIndex === "bigint") {
    return String(turnIndex);
  }
  if (typeof turnIndex === "string") {
    return turnIndex;
  }
  return "unknown";
}

/**
 * Main extension function
 */
export default function (pi: ExtensionAPI) {
  // Track turn start time for per-turn duration
  const turnStartTimes = new Map<string, number>();
  // Track first text delta time per turn (for accurate tok/s calculation)
  const turnFirstDeltaTimes = new Map<string, number>();
  // Track last text delta time per turn
  const turnLastDeltaTimes = new Map<string, number>();
  // Current turn key (set by turn_start, used by message_update)
  let currentTurnKey: string | null = null;
  // Track agent start time for total agent duration
  let agentStartTime: number | null = null;
  // Track last turn end timestamp for total agent duration
  let lastTurnEndTimestamp: number | null = null;
  // Accumulate all token usage stats for the agent
  let totalOutputTokens = 0;
  // Accumulate total generation time for accurate agent-level tok/s
  let totalGenerationMs = 0;

  // Accumulate cost breakdown for the agent
  let totalCostInput = 0;
  let totalCostOutput = 0;
  let totalCostCacheRead = 0;
  let totalCostCacheWrite = 0;
  let totalCost = 0;

  /**
   * Hook into turn start event
   * Records the start time for each turn
   */
  pi.on("turn_start", (event: TurnStartEvent, _ctx: ExtensionContext) => {
    const turnKey = getTurnKey(event.turnIndex);
    turnStartTimes.set(turnKey, Date.now());
    currentTurnKey = turnKey;
  });

  /**
   * Hook into message update event
   * Tracks first and last text delta times for accurate tok/s calculation
   */
  (
    pi as ExtensionAPI & {
      on(
        event: "message_update",
        handler: (
          event: MessageUpdateEvent,
          ctx: ExtensionContext,
        ) => Promise<void>,
      ): void;
    }
  ).on(
    "message_update",
    (event: MessageUpdateEvent, _ctx: ExtensionContext) => {
      if (currentTurnKey === null) return;

      const assistantEvent = event.assistantMessageEvent;
      // Track timing on text_delta events (actual token streaming)
      if (assistantEvent.type === "text_delta") {
        const now = Date.now();
        // Record first delta time if not set
        if (!turnFirstDeltaTimes.has(currentTurnKey)) {
          turnFirstDeltaTimes.set(currentTurnKey, now);
        }
        // Always update last delta time
        turnLastDeltaTimes.set(currentTurnKey, now);
      }
    },
  );

  /**
   * Hook into turn end event
   * Reports the per-turn duration and token usage
   */
  pi.on("turn_end", (event: TurnEndEvent, ctx: ExtensionContext) => {
    const eventTurnKey = getTurnKey(event.turnIndex);
    const turnKey = turnStartTimes.has(eventTurnKey)
      ? eventTurnKey
      : (currentTurnKey ?? eventTurnKey);

    const startTime = turnStartTimes.get(turnKey);
    const firstDeltaTime = turnFirstDeltaTimes.get(turnKey);
    const lastDeltaTime = turnLastDeltaTimes.get(turnKey);

    // Clean up turn tracking
    turnStartTimes.delete(turnKey);
    turnFirstDeltaTimes.delete(turnKey);
    turnLastDeltaTimes.delete(turnKey);
    currentTurnKey = null;

    // Only track assistant messages
    const message = event.message;
    if (message.role !== "assistant") {
      return;
    }

    const usage = message.usage;

    const turnEndTimestamp = Date.now();
    const durationMs =
      startTime !== undefined ? Math.max(0, turnEndTimestamp - startTime) : 0;
    lastTurnEndTimestamp = turnEndTimestamp;

    // Calculate generation time (prefer text streaming window, fallback to full turn duration)
    const generationMsFromStream =
      firstDeltaTime !== undefined && lastDeltaTime !== undefined
        ? Math.max(0, lastDeltaTime - firstDeltaTime)
        : undefined;
    const generationMs =
      generationMsFromStream !== undefined && generationMsFromStream > 0
        ? generationMsFromStream
        : durationMs > 0
          ? durationMs
          : undefined;

    // Get token information from the message
    const outputTokens = usage.output;
    const cost = usage.cost;
    const costInput = cost.input;
    const costOutput = cost.output;
    const costCacheRead = cost.cacheRead;
    const costCacheWrite = cost.cacheWrite;
    const costTotal = cost.total;

    // Accumulate all token stats
    totalOutputTokens += outputTokens;

    // Accumulate generation time for agent-level tok/s
    if (generationMs !== undefined) {
      totalGenerationMs += generationMs;
    }

    // Accumulate cost breakdown
    totalCostInput += costInput;
    totalCostOutput += costOutput;
    totalCostCacheRead += costCacheRead;
    totalCostCacheWrite += costCacheWrite;
    totalCost += costTotal;

    // Format simple output: ↓<output_tokens> | <duration> | <tok/s> | <cost>
    const notificationStr = formatSimpleOutput(
      outputTokens,
      durationMs,
      cost,
      generationMs,
    );

    // Notify user if UI is available
    ctx.ui.notify(notificationStr, "info");
  });

  /**
   * Hook into agent start event
   * Records the start time for the agent
   */
  pi.on("agent_start", (_event: AgentStartEvent, _ctx: ExtensionContext) => {
    agentStartTime ??= Date.now();
  });

  /**
   * Hook into agent end event
   * Reports the agent end duration and token stats
   */
  pi.on("agent_end", (_event: AgentEndEvent, ctx: ExtensionContext) => {
    if (agentStartTime !== null) {
      const endTimestamp = lastTurnEndTimestamp ?? Date.now();
      const totalDurationMs = endTimestamp - agentStartTime;

      // Format simple output: ↓<output_tokens> | <duration> | <tok/s> | <cost>
      const notificationStr = formatSimpleOutput(
        totalOutputTokens,
        totalDurationMs,
        {
          input: totalCostInput,
          output: totalCostOutput,
          cacheRead: totalCostCacheRead,
          cacheWrite: totalCostCacheWrite,
          total: totalCost,
        },
        totalGenerationMs > 0 ? totalGenerationMs : undefined,
      );

      // Notify user if UI is available
      if (ctx.hasUI) {
        ctx.ui.notify(notificationStr, "info");
      }

      // Reset for next agent run
      totalOutputTokens = 0;
      totalGenerationMs = 0;
      totalCostInput = 0;
      totalCostOutput = 0;
      totalCostCacheRead = 0;
      totalCostCacheWrite = 0;
      totalCost = 0;
    }
  });

  /**
   * Helper function to reset all counters
   */
  function resetCounters(): void {
    turnStartTimes.clear();
    turnFirstDeltaTimes.clear();
    turnLastDeltaTimes.clear();
    currentTurnKey = null;
    agentStartTime = null;
    lastTurnEndTimestamp = null;
    totalOutputTokens = 0;
    totalGenerationMs = 0;
    totalCostInput = 0;
    totalCostOutput = 0;
    totalCostCacheRead = 0;
    totalCostCacheWrite = 0;
    totalCost = 0;
  }

  /**
   * Hook into session start event
   * Resets timer tracking when a new session begins
   */
  pi.on("session_start", (_event: SessionStartEvent) => {
    resetCounters();
  });

  /**
   * Hook into session shutdown event
   */
  pi.on("session_shutdown", (_event: SessionShutdownEvent) => {
    resetCounters();
  });
}
