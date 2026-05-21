import type { ToolStats } from "./types";
import {
  findSessionFiles,
  processSessionFiles,
  aggregateStats,
  getSessionsDir,
  type UsageCall,
} from "../lib/session-parser";

function extractToolCalls(
  contents: unknown[],
  sessionId: string,
  timestamp: number,
): UsageCall[] {
  const calls: UsageCall[] = [];
  for (const content of contents) {
    const c = content as { type?: string; name?: string };
    if (c?.type !== "toolCall" || !c.name) continue;
    calls.push({
      name: c.name,
      sessionId,
      timestamp: String(timestamp),
    });
  }
  return calls;
}

function mapToToolStats(agg: ReturnType<typeof aggregateStats>): ToolStats {
  const mapBuckets = (
    buckets: Record<string, { count: number; items: Record<string, number> }>,
  ): Record<string, { count: number; tools: Record<string, number> }> => {
    const result: Record<
      string,
      { count: number; tools: Record<string, number> }
    > = {};
    for (const [key, { count, items }] of Object.entries(buckets)) {
      result[key] = { count, tools: items };
    }
    return result;
  };

  return {
    totalSessions: agg.totalSessions,
    totalToolCalls: agg.totalCalls,
    byTool: agg.byItem,
    bySession: mapBuckets(agg.bySession),
    byDate: mapBuckets(agg.byDate),
  };
}

export async function collectToolStats(
  signal?: AbortSignal,
): Promise<ToolStats | null> {
  const sessionsDir = getSessionsDir();
  const filePaths = await findSessionFiles(sessionsDir);
  if (signal?.aborted) return null;

  const { calls, sessionCount } = await processSessionFiles(
    filePaths,
    extractToolCalls,
    signal,
  );

  return mapToToolStats(aggregateStats(calls, sessionCount));
}
