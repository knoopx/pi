import {
  formatNumber,
  stripHtml,
} from "../../../../shared/format/text-formatting";
import type { RedditCommentData } from "./types";

export function renderComment(
  comment: RedditCommentData,
  depth: number,
): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  lines.push(buildCommentHeader(comment, indent));
  lines.push(...buildCommentBody(comment, indent));

  if (comment.replies?.data?.children && depth < 3) {
    for (const child of comment.replies.data.children) {
      if (child.kind === "more") continue;
      lines.push("");
      lines.push(...renderComment(child.data, depth + 1));
    }
  }

  return lines;
}

function buildCommentHeader(
  comment: RedditCommentData,
  indent: string,
): string {
  const author = comment.author || "[deleted]";
  const score = comment.score > 0 ? ` (${formatNumber(comment.score)})` : "";
  return `${indent}**${author}**${score}`;
}

function buildCommentBody(
  comment: RedditCommentData,
  indent: string,
): string[] {
  const body = stripHtml(comment.body);
  if (!body) return [`${indent}[deleted]`];
  return body.split("\n").map((line) => `${indent}${line}`);
}
