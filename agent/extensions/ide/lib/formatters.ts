import type { AgentWorkspace } from "./types";


export function formatFileStats(ws: AgentWorkspace): string {
  if (!ws.fileStats) return "";
  const { added, modified, deleted } = ws.fileStats;
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added}`);
  if (modified > 0) parts.push(`~${modified}`);
  if (deleted > 0) parts.push(`-${deleted}`);
  return parts.length > 0 ? `[${parts.join(" ")}]` : "";
}


export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
