import type {
  ExtensionAPI,
  ExtensionContext,
  TurnStartEvent,
  TurnEndEvent,
  AgentEndEvent,
} from "@mariozechner/pi-coding-agent";
import type { Usage } from "@mariozechner/pi-ai";

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

export function formatCost(usage: Usage | undefined | null): string {
  // If usage is undefined or null, return empty string
  if (!usage) {
    return "";
  }

  // Use cost.total from the Usage type
  const total = usage.cost.total;

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
  usage: Usage | undefined,
  generationMs?: number,
): string {
  const outputStr = formatTokens(output);
  const durationStr = formatDuration(durationMs);
  const tokPerSecStr = formatTokensPerSecond(output, generationMs);
  const costStr = formatCost(usage);

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

/**
 * Main extension function
 */
export default function (pi: ExtensionAPI) {
  // Track turn start time for per-turn duration
  const turnStartTimes = new Map<number, number>();
  // Track agent start time for total agent duration
  let agentStartTime: number | null = null;
  // Track last turn end timestamp for total agent duration
  let lastTurnEndTimestamp: number | null = null;
  // Accumulate all token usage stats for the agent
  let totalOutputTokens = 0;
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
  pi.on("turn_start", (event: TurnStartEvent) => {
    turnStartTimes.set(event.turnIndex, Date.now());
  });

  /**
   * Hook into turn end event
   * Reports the per-turn duration and token usage
   */
  pi.on("turn_end", (event: TurnEndEvent, ctx: ExtensionContext) => {
    const turnIndex = event.turnIndex;

    const startTime = turnStartTimes.get(turnIndex);

    // Clean up turn tracking
    turnStartTimes.delete(turnIndex);

    // Only track assistant messages
    const message = event.message;
    if (message.role !== "assistant") {
      return;
    }

    const usage = message.usage as Usage;

    const turnEndTimestamp = Date.now();
    const durationMs =
      startTime !== undefined ? Math.max(0, turnEndTimestamp - startTime) : 0;
    lastTurnEndTimestamp = turnEndTimestamp;

    // Get token information from the message
    const outputTokens = usage.output;
    const cost = usage.cost;

    // Accumulate all token stats
    totalOutputTokens += outputTokens;

    // Accumulate cost breakdown
    totalCostInput += cost.input;
    totalCostOutput += cost.output;
    totalCostCacheRead += cost.cacheRead;
    totalCostCacheWrite += cost.cacheWrite;
    totalCost += cost.total;

    // Format simple output: ↓<output_tokens> | <duration> | <cost>
    const notificationStr = formatSimpleOutput(outputTokens, durationMs, usage);

    // Notify user if UI is available
    ctx.ui.notify(notificationStr, "info");
  });

  /**
   * Hook into agent start event
   * Records the start time for the agent
   */
  pi.on("agent_start", () => {
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

      // Format simple output: ↓<output_tokens> | <duration> | <cost>
      const notificationStr = formatSimpleOutput(
        totalOutputTokens,
        totalDurationMs,
        {
          input: 0,
          output: totalOutputTokens,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: totalOutputTokens,
          cost: {
            input: totalCostInput,
            output: totalCostOutput,
            cacheRead: totalCostCacheRead,
            cacheWrite: totalCostCacheWrite,
            total: totalCost,
          },
        },
      );

      // Notify user if UI is available
      if (ctx.hasUI) {
        ctx.ui.notify(notificationStr, "info");
      }

      // Reset for next agent run
      totalOutputTokens = 0;
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
    agentStartTime = null;
    lastTurnEndTimestamp = null;
    totalOutputTokens = 0;
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
  pi.on("session_start", () => {
    resetCounters();
  });

  /**
   * Hook into session shutdown event
   */
  pi.on("session_shutdown", () => {
    resetCounters();
  });
}
