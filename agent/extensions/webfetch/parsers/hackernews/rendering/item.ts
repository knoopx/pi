import {
  formatNumber,
  stripHtml,
} from "../../../../../shared/format/text-formatting";
import type { HNItem } from "../types";
import { HN_BASE } from "../constants";

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderDeletedItem(id: number): string {
  return `# Item #${id}\n\nThis item has been deleted or marked as dead.`;
}

function renderItemHeader(item: HNItem): string[] {
  const parts: string[] = [];
  if (item.title) parts.push(`# ${item.title}`);
  if (item.url) parts.push(`[**${item.url}**](${item.url})`);
  return parts;
}

function renderItemText(item: HNItem): string[] {
  if (!item.text) return [];
  const clean = stripHtml(item.text);
  if (!clean) return [];
  return ["", clean];
}

function renderItemLink(item: HNItem): string {
  return `[View on Hacker News](${HN_BASE}/item?id=${item.id})`;
}

function buildItemMeta(item: HNItem): string {
  const meta: string[] = [`id: ${item.id}`, `type: ${item.type}`];
  if (item.by) meta.push(`by: [${item.by}](${HN_BASE}/user?id=${item.by})`);
  if (item.time) meta.push(formatTime(item.time));
  return meta.join(" \u2022 ");
}

function buildItemStats(item: HNItem): string {
  const stats: string[] = [];
  if (item.score !== undefined)
    stats.push(`score: ${formatNumber(item.score)}`);
  if (item.descendants !== undefined)
    stats.push(`comments: ${formatNumber(item.descendants)}`);
  return stats.join(" \u2022 ");
}

function renderItem(item: HNItem): string {
  if (item.deleted || item.dead) {
    return renderDeletedItem(item.id);
  }
  const parts: string[] = [];
  parts.push(...renderItemHeader(item));
  parts.push(buildItemMeta(item));
  parts.push(buildItemStats(item));
  parts.push(...renderItemText(item));
  parts.push("");
  parts.push(renderItemLink(item));

  return parts.join("\n");
}

export { renderItem };
