import { formatAge } from "../../../../shared/format/time-formatting";
import {
  formatNumber,
  stripHtml,
} from "../../../../shared/format/text-formatting";
import type { RedditPostData, RedditListing } from "./types";

const BASE = "https://www.reddit.com";

function makePermalink(permalink: string): string {
  return permalink.startsWith("http") ? permalink : `${BASE}${permalink}`;
}

function extractUrlLink(url: string | undefined, isSelf?: boolean): string[] {
  if (!url || isSelf) return [];
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return [`[${domain}](${url})`];
  } catch {
    return [];
  }
}

interface RenderListingOptions {
  preamble?: string[];
  emptyMessage?: string;
}

function renderEmptyListing(header: string, emptyMessage: string): string {
  return [header, "", emptyMessage].join("\n");
}

function prependPreamble(parts: string[], preamble: string[]): void {
  if (preamble.length > 0) parts.push(...preamble, "");
}

function shouldRenderEmpty(
  listing: RedditListing,
  opts: RenderListingOptions,
): opts is RenderListingOptions & { emptyMessage: string } {
  return !listing.data.children.length && !!opts.emptyMessage;
}

function appendPostRows(
  parts: string[],
  posts: Array<{ data: RedditPostData }>,
): void {
  for (const { data: post } of posts) {
    if (parts.length > 1) parts.push("");
    parts.push(...renderPost(post));
  }
}

export function renderListing(
  header: string,
  listing: RedditListing,
  opts: RenderListingOptions = {},
): string {
  const parts: string[] = [header, ``];

  if (shouldRenderEmpty(listing, opts)) {
    return renderEmptyListing(header, opts.emptyMessage);
  }

  prependPreamble(parts, opts.preamble ?? []);
  appendPostRows(parts, listing.data.children);
  return parts.join("\n");
}

function renderPost(post: RedditPostData): string[] {
  const lines: string[] = [];
  let title = post.title;
  if (post.link_flair_text) title = `[${post.link_flair_text}] ${title}`;
  lines.push(`**${title}**`);

  lines.push(buildPostMeta(post));
  lines.push(...buildPostLink(post));
  lines.push(`[\u2197 reddit](${makePermalink(post.permalink)})`);

  return lines;
}

function buildPostMeta(post: RedditPostData): string {
  const meta: string[] = [
    `r/${post.subreddit}`,
    post.author ? `u/${post.author}` : "",
    `${formatNumber(post.score)} points`,
    `${formatNumber(post.num_comments)} comments`,
    formatAge(post.created_utc),
  ].filter(Boolean);
  return meta.join(" • ");
}

function buildPostLink(post: RedditPostData): string[] {
  const link = extractUrlLink(post.url, post.is_self);
  if (link.length) return link;

  if (post.selftext) {
    const snippet = stripHtml(post.selftext).split("\n").filter(Boolean)[0];
    if (snippet) return [snippet];
  }

  return [];
}
