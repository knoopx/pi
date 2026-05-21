import {
  formatNumber,
  stripHtml,
} from "../../../../shared/format/text-formatting";
import type { RedditCommentData } from "./types";

type ReplyChildren = NonNullable<
  NonNullable<RedditCommentData["replies"]>["data"]
>["children"];

function getReplyChildren(comment: RedditCommentData): ReplyChildren {
  return comment.replies?.data?.children ?? [];
}

function shouldRenderChildren(
  comment: RedditCommentData,
  depth: number,
): ReplyChildren | null {
  if (depth >= 3) return null;
  const children = getReplyChildren(comment);
  return children.length > 0 ? children : null;
}

function shouldSkipChild(child: { kind?: string }): boolean {
  return child.kind === "more";
}

function renderCommentChildren(
  comment: RedditCommentData,
  depth: number,
): string[] {
  const children = shouldRenderChildren(comment, depth);
  if (!children) return [];

  const lines: string[] = [];
  for (const child of children) {
    if (shouldSkipChild(child)) continue;
    lines.push("");
    lines.push(...renderComment(child.data, depth + 1));
  }
  return lines;
}

export function renderComment(
  comment: RedditCommentData,
  depth: number,
): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  lines.push(buildCommentHeader(comment, indent));
  lines.push(...buildCommentBody(comment, indent));
  lines.push(...renderCommentChildren(comment, depth));

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
