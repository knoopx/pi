import type { SkillStats } from "./types";
import {
  findSessionFiles,
  processSessionFiles,
  aggregateStats,
  getSessionsDir,
  type UsageCall,
} from "../lib/session-parser";

function extractSkillName(path: string): string | null {
  if (!path.includes("SKILL.md")) return null;
  const idx = path.lastIndexOf("/SKILL.md");
  if (idx <= 0) return null;
  const segment = path.slice(0, idx).split("/").pop();
  return segment || null;
}

function isSkillReadCall(
  content: unknown,
): content is { arguments: { path: string } } {
  const c = content as { type?: string; name?: string; arguments?: unknown };
  if (c?.type !== "toolCall" || c.name !== "read") return false;
  const args = c.arguments as Record<string, unknown> | undefined;
  return !!args && typeof args.path === "string";
}

function extractSkillCalls(
  contents: unknown[],
  sessionId: string,
  timestamp: number,
): UsageCall[] {
  const calls: UsageCall[] = [];
  const ts = String(timestamp);
  for (const content of contents) {
    if (!isSkillReadCall(content)) continue;
    const name = extractSkillName(content.arguments.path);
    if (!name) continue;
    calls.push({ name, sessionId, timestamp: ts });
  }
  return calls;
}

function mapToSkillStats(agg: ReturnType<typeof aggregateStats>): SkillStats {
  const mapBuckets = (
    buckets: Record<string, { count: number; items: Record<string, number> }>,
  ): Record<string, { count: number; skills: Record<string, number> }> => {
    const result: Record<
      string,
      { count: number; skills: Record<string, number> }
    > = {};
    for (const key of Object.keys(buckets)) {
      const { count, items } = buckets[key];
      result[key] = { count, skills: items };
    }
    return result;
  };

  return {
    totalSessions: agg.totalSessions,
    totalSkillCalls: agg.totalCalls,
    bySkill: agg.byItem,
    bySession: mapBuckets(agg.bySession),
    byDate: mapBuckets(agg.byDate),
  };
}

export async function collectSkillStats(
  signal?: AbortSignal,
): Promise<SkillStats | null> {
  if (signal?.aborted) return null;
  const sessionsDir = getSessionsDir();
  const filePaths = await findSessionFiles(sessionsDir);
  if (signal?.aborted) return null;

  const { calls, sessionCount } = await processSessionFiles(
    filePaths,
    extractSkillCalls,
    signal,
  );

  return mapToSkillStats(aggregateStats(calls, sessionCount));
}
