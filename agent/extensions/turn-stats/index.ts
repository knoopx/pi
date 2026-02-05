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
import type { AssistantMessage } from "@mariozechner/pi-ai";

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
    return `${hours}h ${minutes}m ${Math.floor(seconds)}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${Math.floor(seconds)}s`;
  }
  // If seconds is less than 1, show decimal places
  if (seconds < 1) {
    return `${seconds.toFixed(2)}s`;
  }
  return `${Math.floor(seconds)}s`;
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

  // If cost.total exists, use that
  if (cost.total !== undefined) {
    // Only return cost if it's non-zero
    if (cost.total === 0) {
      return "";
    }
    return `$${cost.total.toFixed(2)}`;
  }

  // Otherwise, sum up the individual costs
  const total =
    (cost.input || 0) +
    (cost.output || 0) +
    (cost.cacheRead || 0) +
    (cost.cacheWrite || 0);
  // Only return cost if it's non-zero
  if (total === 0) {
    return "";
  }
  return `$${total.toFixed(2)}`;
}

/**
 * Format tokens per second
 * @param tokens Output tokens
 * @param durationMs Duration in milliseconds
 * @returns Formatted tokens/s string (e.g., "52.3 tok/s")
 */
export function formatTokensPerSecond(
  tokens: number | undefined,
  durationMs: number,
): string {
  if (tokens === undefined || tokens === null || durationMs <= 0) {
    return "";
  }
  const tokensPerSecond = tokens / (durationMs / 1000);
  return `${tokensPerSecond.toFixed(1)} tok/s`;
}

/**
 * Simplified format for output tokens, duration, tokens/s, and cost
 * Format: ↓<output_tokens> <duration> <tok/s> <cost>
 * Example: ↓1.9K 36s 52.3 tok/s $0.01 (without cost if 0)
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
): string {
  const outputStr = formatTokens(output);
  const durationStr = formatDuration(durationMs);
  const tokPerSecStr = formatTokensPerSecond(output, durationMs);
  const costStr = formatCost(cost);

  // Build the output string with optional parts
  let result = `↓${outputStr} ${durationStr}`;
  if (tokPerSecStr) {
    result += ` ${tokPerSecStr}`;
  }
  if (costStr) {
    result += ` ${costStr}`;
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
  pi.on("turn_start", async (event: TurnStartEvent, _ctx: ExtensionContext) => {
    turnStartTimes.set(event.turnIndex, event.timestamp);
  });

  /**
   * Hook into turn end event
   * Reports the per-turn duration and token usage
   */
  pi.on("turn_end", async (event: TurnEndEvent, ctx: ExtensionContext) => {
    const startTime = turnStartTimes.get(event.turnIndex);

    if (startTime) {
      const message = event.message;
      const assistantMessage = message as AssistantMessage | undefined;
      const turnEndTimestamp = assistantMessage?.timestamp ?? Date.now();
      const durationMs = turnEndTimestamp - startTime;
      turnStartTimes.delete(event.turnIndex);
      lastTurnEndTimestamp = turnEndTimestamp;

      // Get token information from the message
      const usage = assistantMessage?.usage;
      const outputTokens = usage?.output;
      const cost = usage?.cost;
      const costInput = cost?.input;
      const costOutput = cost?.output;
      const costCacheRead = cost?.cacheRead;
      const costCacheWrite = cost?.cacheWrite;
      const costTotal = cost?.total;

      // Accumulate all token stats
      if (outputTokens !== undefined) {
        totalOutputTokens += outputTokens;
      }

      // Accumulate cost breakdown
      if (costInput !== undefined) {
        totalCostInput += costInput;
      }
      if (costOutput !== undefined) {
        totalCostOutput += costOutput;
      }
      if (costCacheRead !== undefined) {
        totalCostCacheRead += costCacheRead;
      }
      if (costCacheWrite !== undefined) {
        totalCostCacheWrite += costCacheWrite;
      }
      if (costTotal !== undefined) {
        totalCost += costTotal;
      }

      // Format simple output: ↓<output_tokens> <duration> <cost>
      const notificationStr = formatSimpleOutput(
        outputTokens,
        durationMs,
        cost,
      );

      // Notify user if UI is available
      ctx.ui.notify(notificationStr, "info");
    }
  });

  /**
   * Hook into agent start event
   * Records the start time for the agent
   */
  pi.on(
    "agent_start",
    async (_event: AgentStartEvent, _ctx: ExtensionContext) => {
      if (!agentStartTime) {
        agentStartTime = Date.now();
      }
    },
  );

  /**
   * Hook into agent end event
   * Reports the agent end duration and token stats
   */
  pi.on("agent_end", async (_event: AgentEndEvent, ctx: ExtensionContext) => {
    if (agentStartTime) {
      const endTimestamp = lastTurnEndTimestamp ?? Date.now();
      const totalDurationMs = endTimestamp - agentStartTime;

      // Format simple output: ↓<output_tokens> <duration> <cost>
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
  pi.on("session_start", async (_event: SessionStartEvent) => {
    resetCounters();
  });

  /**
   * Hook into session shutdown event
   */
  pi.on("session_shutdown", async (_event: SessionShutdownEvent) => {
    resetCounters();
  });
}
