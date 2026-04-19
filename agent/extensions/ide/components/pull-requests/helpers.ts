import type { Theme } from "@mariozechner/pi-coding-agent";
import { formatRelativeTime } from "../../lib/formatters";
import type { PrStateColor } from "./types";


const PR_STATE_ICONS: Record<string, string> = {
  OPEN: "󰐊",
  CLOSED: "󰅖",
  MERGED: "󰘬",
};


const REVIEW_ICONS: Record<string, string> = {
  APPROVED: "󰄬",
  CHANGES_REQUESTED: "󰌑",
  REVIEW_REQUIRED: "󰈈",
};

export function getPrIcon(state: string, isDraft: boolean): string {
  if (isDraft) return "󰽾";
  return PR_STATE_ICONS[state] || "󰐊";
}

export function getReviewIcon(decision: string | null): string {
  if (!decision) return "";
  return REVIEW_ICONS[decision] || "";
}

export function resolvePrStateColor(
  state: string,
  isDraft: boolean,
): PrStateColor {
  if (state === "MERGED") return "accent";
  if (state === "CLOSED") return "error";
  if (isDraft) return "dim";
  return "success";
}

export function buildPrStats(
  theme: Theme,
  additions: number,
  deletions: number,
): string {
  const addText = theme.fg("success", `+${additions}`);
  const delText = theme.fg("error", `-${deletions}`);
  return `${addText}/${delText}`;
}

export function buildPrFixedParts(options: {
  icon: string;
  reviewIcon: string;
  number: number;
  headRefName: string;
  author: string;
  additions: number;
  deletions: number;
  updatedAt: string;
}): string {
  const { icon, reviewIcon, number, headRefName, author, additions, deletions, updatedAt } = options;
  return [
    `${icon} `,
    `#${number} `,
    reviewIcon ? `${reviewIcon} ` : "",
    ` ${headRefName}`,
    ` @${author}`,
    ` +${additions}/-${deletions}`,
    ` ${formatRelativeTime(updatedAt)}`,
  ].join("");
}

export function truncateTitle(title: string, maxWidth: number): string {
  if (title.length <= maxWidth) return title;
  return `${title.slice(0, maxWidth - 1)}…`;
}

export function formatReviewIcon(
  reviewIcon: string,
  decision: string | null,
  theme: Theme,
): string {
  if (!reviewIcon) return "";
  const color = decision === "APPROVED" ? "success" : "warning";
  return `${theme.fg(color, reviewIcon)} `;
}
