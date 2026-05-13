import { formatAge } from "../../../../../shared/format/time-formatting";
import { formatNumber } from "../../../../../shared/format/text-formatting";
import type { HNItem } from "../types";
import { HN_BASE } from "../constants";

function buildStoryItem(rank: number, item: HNItem): string[] {
  const titleLine = buildStoryTitle(rank, item);
  const metaLine = buildStoryMeta(item);
  const linkLine = `    [HN](${HN_BASE}/item?id=${item.id})`;
  return [titleLine, metaLine, linkLine];
}

function buildStoryTitle(rank: number, item: HNItem): string {
  const title = item.title || "(no title)";
  if (item.url) return `**${rank}. ${title}** [${item.url}](${item.url})`;
  return `**${rank}. ${title}**`;
}

function buildStoryMeta(item: HNItem): string {
  const meta: string[] = [];
  if (item.score !== undefined) meta.push(`score: ${formatNumber(item.score)}`);
  if (item.by) meta.push(`by: ${item.by}`);
  if (item.descendants !== undefined)
    meta.push(`comments: ${formatNumber(item.descendants)}`);
  if (item.time) meta.push(formatAge(item.time));
  return meta.join(" • ");
}

export { buildStoryItem };
