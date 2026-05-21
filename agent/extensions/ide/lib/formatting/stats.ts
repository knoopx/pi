import type { AgentWorkspace } from "../../types";
function buildFileStatParts(stats: {
  added: number;
  modified: number;
  deleted: number;
}): string[] {
  const parts: string[] = [];
  if (stats.added > 0) parts.push(`+${stats.added}`);
  if (stats.modified > 0) parts.push(`~${stats.modified}`);
  if (stats.deleted > 0) parts.push(`-${stats.deleted}`);
  return parts;
}

export function formatFileStats(ws: AgentWorkspace): string {
  if (!ws.fileStats) return "";
  const parts = buildFileStatParts(ws.fileStats);
  if (parts.length === 0) return "";
  return `[${parts.join(" ")}]`;
}
export function formatRelativeTime(
  dateStr: string,
  referenceDate: Date = new Date(),
): string {
  const date = new Date(dateStr);
  const diffMs = referenceDate.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
