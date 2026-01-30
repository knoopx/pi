/**
 * Reddit extension - see the [new top hot rising] posts from a subreddit.
 *
 * Usage:
 *   /reddit subreddit [hot|new|top|rising] [limit]
 *   /reddit programming
 *   /reddit peloton new 5
 *
 */

import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { type TUI } from "@mariozechner/pi-tui";
import { spawn } from "child_process";

// Local implementations to override pi-tui functions that have incorrect emoji counting
/**
 * Check if input matches a key
 */
function matchesKey(input: string, key: string): boolean {
  switch (key) {
    case "escape":
      return input === "\u001b" || input === "\u001b[" || input === "\u001b[?";
    case "ctrl+c":
      return input === "\u0003";
    case "up":
      return input === "\u001b[A" || input === "\u001bOA";
    case "down":
      return input === "\u001b[B" || input === "\u001bOB";
    case "enter":
      return input === "\r" || input === "\n";
    case "home":
      return input === "\u001b[H" || input === "\u001b[1~";
    case "end":
      return input === "\u001b[F" || input === "\u001b[4~";
    case "pageUp":
      return input === "\u001b[5~" || input === "\u001b[I";
    case "pageDown":
      return input === "\u001b[6~" || input === "\u001b[G";
    case "ctrl+b":
      return input === "\u0002";
    case "ctrl+f":
      return input === "\u0006";
    case "space":
      return input === " ";
    default:
      return false;
  }
}

/**
 * Calculate the visible width of a string in terminal columns.
 * This implementation counts emojis as 1, not 2, which is the expected behavior.
 */
function visibleWidth(str: string): number {
  if (str.length === 0) {
    return 0;
  }

  // Fast path: pure ASCII printable
  let isPureAscii = true;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      isPureAscii = false;
      break;
    }
  }
  if (isPureAscii) {
    return str.length;
  }

  // Normalize: tabs to 3 spaces, strip ANSI escape codes
  let clean = str;
  if (str.includes("\t")) {
    clean = clean.replace(/\t/g, "   ");
  }
  const ESC = "\u001b";
  if (clean.includes(ESC)) {
    // Strip SGR codes (\u001b[...m) and cursor codes (\u001b[...G/K/H/J)
    clean = clean.replace(new RegExp(ESC + "\\[[0-9;]*[mGKHJ]", "g"), "");
    // Strip OSC 8 hyperlinks: \u001b]8;;URL\u0007 and \u001b]8;;\u0007
    clean = clean.replace(
      new RegExp(ESC + "\\]8;;[^\\u0007]*\\u0007", "g"),
      "",
    );
    // Strip APC sequences: \u001b_...\u0007 or \u001b_...\u001b\\ (used for cursor marker)
    clean = clean.replace(
      new RegExp(ESC + "_[^\\u0007\\u001b]*(?:\\u0007|" + ESC + "\\\\)", "g"),
      "",
    );
  }

  // Calculate width (emojis are now counted as 1, not 2)
  let width = 0;
  for (const char of clean) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code > 0x7e || (code >= 0x1f000 && code <= 0x1fffd)) {
      width += 1;
    } else if (code >= 0x2300 && code <= 0x27bf) {
      width += 1;
    } else if (code >= 0xff00 && code <= 0xffef) {
      width += 2;
    } else {
      width += 1;
    }
  }

  return width;
}

/**
 * Truncate a string to fit within a specific visible width.
 * This implementation uses the local visibleWidth function and counts emojis as 1.
 */
function truncateToWidth(
  text: string,
  maxWidth: number,
  ellipsis?: string,
  pad?: boolean,
): string {
  ellipsis = ellipsis || "...";
  const textVisibleWidth = visibleWidth(text);
  if (textVisibleWidth <= maxWidth) {
    return pad ? text + " ".repeat(maxWidth - textVisibleWidth) : text;
  }

  const ellipsisWidth = visibleWidth(ellipsis);
  const targetWidth = maxWidth - ellipsisWidth;
  if (targetWidth <= 0) {
    return ellipsis.substring(0, maxWidth);
  }

  let result = "";
  let currentWidth = 0;
  for (const char of text) {
    const charWidth = visibleWidth(char);
    if (currentWidth + charWidth > targetWidth) {
      break;
    }
    result += char;
    currentWidth += charWidth;
  }

  const truncated = `${result}${ellipsis}`;
  if (pad) {
    const truncatedWidth = visibleWidth(truncated);
    return truncated + " ".repeat(Math.max(0, maxWidth - truncatedWidth));
  }

  return truncated;
}

// Types for parsed Reddit JSON data
interface RedditPost {
  id: string;
  title: string;
  author: string;
  link: string;
  published: string;
  updated: string;
  content: string;
  score: number;
}

interface JSONParseResult {
  subreddit: string;
  feedType: string;
  updated: string;
  posts: RedditPost[];
}

// Spinner frames for loading indicator (pi-style)
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Format relative time (e.g., "5h ago", "2d ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths > 0) return `${diffMonths}mo ago`;
  if (diffWeeks > 0) return `${diffWeeks}w ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
}

/**
 * Extract score/upvotes from post content if available
 */
function extractScore(content: string): number {
  // Reddit JSON doesn't include score directly, but we can try to parse it
  // from the content if it's there. Default to 0 if not found.
  const scoreMatch = content.match(/(\d+)\s*points?/i);
  return scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
}

/**
 * Parse Reddit JSON API response into structured data
 */
function parseRedditJson(
  json: string,
  requestedFeedType: string,
): JSONParseResult | null {
  try {
    const response = JSON.parse(json);

    // Check for error responses (e.g., banned subreddit, not found)
    if (response.reason || response.error) {
      throw new Error(
        `Reddit error: ${response.message || response.reason || `HTTP ${response.error}`}`,
      );
    }

    if (
      response.kind !== "Listing" ||
      !response.data ||
      !Array.isArray(response.data.children)
    ) {
      throw new Error("Invalid Reddit API response format");
    }

    // Get subreddit from the first post
    const firstPost = response.data.children[0]?.data;
    const subreddit = firstPost?.subreddit || "unknown";

    // Parse posts
    const posts: RedditPost[] = response.data.children.map((child: unknown) => {
      const postData = child.data;
      const createdUtc = postData.created_utc * 1000; // Convert to milliseconds
      const published = new Date(createdUtc).toISOString();

      return {
        id: postData.id,
        title: postData.title,
        author: postData.author,
        link: `https://www.reddit.com${postData.permalink}`,
        published,
        updated: published,
        content: postData.selftext || "",
        score: postData.score || 0,
      };
    });

    return {
      subreddit,
      feedType: requestedFeedType,
      updated: new Date().toISOString(),
      posts,
    };
  } catch (error) {
    console.error("Failed to parse Reddit JSON:", error);
    throw error;
  }
}

/**
 * Fetch Reddit posts using JSON API
 */
async function fetchRedditPosts(
  subreddit: string,
  feedType: string,
  timeFilter: string | undefined,
  limit: number,
  signal?: AbortSignal,
): Promise<{ result: JSONParseResult; source: "json" }> {
  const userAgent = "pi-reddit-extension/1.0";

  // Try JSON API
  let jsonUrl = `https://www.reddit.com/r/${subreddit}/${feedType}.json?limit=${limit}`;
  if (feedType === "top" && timeFilter) {
    jsonUrl += `&t=${timeFilter}`;
  }

  const response = await fetch(jsonUrl, {
    signal,
    headers: { "User-Agent": userAgent },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.text();
  const parsed = parseRedditJson(json, feedType);

  if (!parsed || parsed.posts.length === 0) {
    throw new Error(`No posts found in r/${subreddit}`);
  }

  return { result: parsed, source: "json" };
}

/**
 * Wrap text to fit within a given width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word.length > maxWidth ? word.slice(0, maxWidth) : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [""];
}

/**
 * Open URL in the default browser
 */
function openUrl(url: string): void {
  const platform = process.platform;

  if (platform === "darwin") {
    // macOS: use open command
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else if (platform === "win32") {
    // Windows: use start command
    spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
    }).unref();
  } else {
    // Linux: use xdg-open
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

/**
 * Scrollable Reddit posts overlay component
 */
class RedditPostsComponent {
  private result: JSONParseResult;
  private limit: number;
  private theme: Theme;
  private tui: TUI;
  private done: () => void;
  private selectedIndex = 0;
  private scrollOffset = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];
  private maxVisibleLines = 15;
  private postsToShow: RedditPost[];

  constructor(
    result: JSONParseResult,
    limit: number,
    theme: Theme,
    tui: TUI,
    done: () => void,
  ) {
    this.result = result;
    this.limit = limit;
    this.theme = theme;
    this.tui = tui;
    this.done = done;
    this.postsToShow = result.posts.slice(0, limit);
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.done();
    } else if (matchesKey(data, "up")) {
      // Navigate to previous post
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        this.scrollToSelected();
        this.invalidate();
        this.tui.requestRender();
      }
    } else if (matchesKey(data, "down")) {
      // Navigate to next post
      if (this.selectedIndex < this.postsToShow.length - 1) {
        this.selectedIndex++;
        this.scrollToSelected();
        this.invalidate();
        this.tui.requestRender();
      }
    } else if (matchesKey(data, "enter")) {
      // Open selected post in browser
      const selectedPost = this.postsToShow[this.selectedIndex];
      if (selectedPost) {
        openUrl(selectedPost.link);
      }
    } else if (matchesKey(data, "home")) {
      this.selectedIndex = 0;
      this.scrollOffset = 0;
      this.invalidate();
      this.tui.requestRender();
    } else if (matchesKey(data, "end")) {
      this.selectedIndex = this.postsToShow.length - 1;
      this.scrollToSelected();
      this.invalidate();
      this.tui.requestRender();
    } else if (matchesKey(data, "pageUp") || matchesKey(data, "ctrl+b")) {
      const jumpAmount = Math.max(1, Math.floor(this.postsToShow.length / 3));
      this.selectedIndex = Math.max(0, this.selectedIndex - jumpAmount);
      this.scrollToSelected();
      this.invalidate();
      this.tui.requestRender();
    } else if (
      matchesKey(data, "pageDown") ||
      matchesKey(data, "ctrl+f") ||
      matchesKey(data, "space")
    ) {
      const jumpAmount = Math.max(1, Math.floor(this.postsToShow.length / 3));
      this.selectedIndex = Math.min(
        this.postsToShow.length - 1,
        this.selectedIndex + jumpAmount,
      );
      this.scrollToSelected();
      this.invalidate();
      this.tui.requestRender();
    }
  }

  /**
   * Scroll to ensure the selected post is visible
   */
  private scrollToSelected(): void {
    const postLineIndices = this.getPostLineIndices();
    const postStart = postLineIndices[this.selectedIndex];
    const postEnd =
      this.selectedIndex < postLineIndices.length - 1
        ? postLineIndices[this.selectedIndex + 1]
        : this.getAllLines().length;

    if (postStart < this.scrollOffset) {
      this.scrollOffset = postStart;
    } else if (postEnd > this.scrollOffset + this.maxVisibleLines) {
      this.scrollOffset = Math.max(0, postEnd - this.maxVisibleLines);
    }
  }

  /**
   * Get the starting line index for each post
   */
  private getPostLineIndices(): number[] {
    const indices: number[] = [];
    let currentLine = 0;

    // Header takes 2 lines
    currentLine += 2;

    for (let i = 0; i < this.postsToShow.length; i++) {
      indices.push(currentLine);
      const post = this.postsToShow[i];
      const postLines = this.createPostLines(post, 78);
      currentLine += postLines.length;
      if (i < this.postsToShow.length - 1) {
        currentLine += 1; // Empty line between posts
      }
    }

    return indices;
  }

  /**
   * Generate all lines for the posts (used for scrolling calculations)
   */
  private getAllLines(): string[] {
    const lines: string[] = [];
    const th = this.theme;

    // Header
    lines.push(
      ` ${th.fg("accent", `r/${this.result.subreddit} · ${this.result.feedType}`)}`,
    );
    lines.push("");

    // Generate post lines
    for (let i = 0; i < this.postsToShow.length; i++) {
      const post = this.postsToShow[i];
      const isSelected = i === this.selectedIndex;
      const boxLines = this.createPostLines(post, 78, isSelected);
      lines.push(...boxLines);
      if (i < this.postsToShow.length - 1) {
        lines.push("");
      }
    }

    // Footer
    lines.push("");
    lines.push(` ${th.fg("dim", "↑↓: navigate • Enter: open • Esc: close")}`);

    return lines;
  }

  /**
   * Create lines for a single post
   */
  private createPostLines(
    post: RedditPost,
    boxWidth: number = 78,
    isSelected: boolean = false,
  ): string[] {
    const th = this.theme;
    const lines: string[] = [];
    const innerWidth = boxWidth - 4;
    const marker = isSelected ? th.fg("accent", "►") : " ";

    // Top border - use different style for selected post and add marker
    if (isSelected) {
      lines.push(th.fg("accent", "►┌" + "─".repeat(boxWidth - 3) + "┐"));
    } else {
      lines.push(th.fg("border", " ┌" + "─".repeat(boxWidth - 3) + "┐"));
    }

    // Title lines (wrapped) - highlight title for selected post
    const titleLines = wrapText(post.title, innerWidth);
    for (const titleLine of titleLines) {
      const styledTitle = isSelected ? th.fg("accent", titleLine) : titleLine;
      lines.push(
        marker +
          th.fg("border", "│") +
          styledTitle +
          " ".repeat(Math.max(0, innerWidth - visibleWidth(titleLine))) +
          th.fg("border", "│"),
      );
    }

    // Empty line
    lines.push(
      th.fg("border", " │") + " ".repeat(boxWidth - 3) + th.fg("border", "│"),
    );

    // Bottom info line: author + time on left, upvotes on right
    const authorTime = `${post.author} · ${formatRelativeTime(post.published)}`;
    const upvotes = post.score > 0 ? `▲ ${post.score}` : "▲ -";
    const middleSpace =
      innerWidth - visibleWidth(authorTime) - visibleWidth(upvotes);

    if (middleSpace >= 2) {
      const styledUpvotes = isSelected ? th.fg("accent", upvotes) : upvotes;
      lines.push(
        marker +
          th.fg("border", "│") +
          authorTime +
          " ".repeat(middleSpace) +
          styledUpvotes +
          th.fg("border", "│"),
      );
    } else {
      const authorPadded = authorTime.padEnd(innerWidth);
      lines.push(
        marker + th.fg("border", "│") + authorPadded + th.fg("border", "│"),
      );
      const upvotesPadded = upvotes.padStart(innerWidth);
      const styledUpvotesPadded = isSelected
        ? th.fg("accent", upvotesPadded)
        : upvotesPadded;
      lines.push(
        marker +
          th.fg("border", "│") +
          styledUpvotesPadded +
          th.fg("border", "│"),
      );
    }

    // Bottom border - use different style for selected post and add marker
    if (isSelected) {
      lines.push(th.fg("accent", "►└" + "─".repeat(boxWidth - 3) + "┘"));
    } else {
      lines.push(th.fg("border", " └" + "─".repeat(boxWidth - 3) + "┘"));
    }

    return lines;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const allLines = this.getAllLines();
    const visibleLines = allLines.slice(
      this.scrollOffset,
      this.scrollOffset + this.maxVisibleLines,
    );
    const th = this.theme;

    // Build box around visible content
    const result: string[] = [];
    const innerW = Math.max(1, width - 2);
    const padLine = (s: string) => truncateToWidth(s, innerW, "...", true);

    const title = truncateToWidth(
      ` Reddit: ${this.postsToShow.length} posts `,
      innerW,
    );
    const titlePad = Math.max(0, innerW - visibleWidth(title));

    result.push(
      th.fg("border", "╭") +
        th.fg("accent", title) +
        th.fg("border", "─".repeat(titlePad) + "╮"),
    );

    // Scroll indicators
    const canScrollUp = this.scrollOffset > 0;
    const canScrollDown =
      this.scrollOffset < allLines.length - this.maxVisibleLines;
    const scrollInfo = `↑${this.scrollOffset}/${allLines.length}↓`;

    if (canScrollUp || canScrollDown) {
      result.push(
        th.fg("border", "│") +
          padLine(th.fg("dim", ` ${scrollInfo}`)) +
          th.fg("border", "│"),
      );
    }

    // Visible content lines
    for (const line of visibleLines) {
      result.push(th.fg("border", "│") + padLine(line) + th.fg("border", "│"));
    }

    // Pad to maxVisibleLines
    for (let i = visibleLines.length; i < this.maxVisibleLines; i++) {
      result.push(th.fg("border", "│") + padLine("") + th.fg("border", "│"));
    }

    result.push(th.fg("border", "╰" + "─".repeat(innerW) + "╯"));

    this.cachedWidth = width;
    this.cachedLines = result;
    return result;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export default function (pi: ExtensionAPI) {
  // Register a command that shows posts in a scrollable overlay at the bottom
  pi.registerCommand("reddit", {
    description: "Display Reddit posts",
    handler: async (args, ctx) => {
      const parts = args?.split(/\s+/) || [];
      const subreddit = parts[0] || "programming";
      const feedType = parts[1] || "hot";
      const limit = Math.min(25, Math.max(1, parseInt(parts[2], 10) || 5));

      // Show loading status with spinner
      ctx.ui.setStatus(
        "reddit",
        `${SPINNER_FRAMES[0]} Loading r/${subreddit}...`,
      );

      // Animate spinner
      let frame = 0;
      const spinnerInterval = setInterval(() => {
        frame = (frame + 1) % SPINNER_FRAMES.length;
        ctx.ui.setStatus(
          "reddit",
          `${SPINNER_FRAMES[frame]} Loading r/${subreddit}...`,
        );
      }, 80);

      try {
        const fetchResult = await fetchRedditPosts(
          subreddit,
          feedType,
          undefined,
          limit,
        );

        clearInterval(spinnerInterval);
        ctx.ui.setStatus("reddit", undefined); // Clear status

        const { result, source } = fetchResult;

        // Show notification with count and source
        ctx.ui.notify(
          `r/${result.subreddit}: ${result.posts.length} ${result.feedType} posts (${source.toUpperCase()})`,
          "info",
        );

        // Display posts in a scrollable overlay above the input line
        await ctx.ui.custom<void>(
          (tui, theme, _kb, done) => {
            const component = new RedditPostsComponent(
              result,
              limit,
              theme,
              tui,
              () => done(),
            );
            return {
              render: (w) => component.render(w),
              invalidate: () => component.invalidate(),
              handleInput: (data) => {
                component.handleInput(data);
                tui.requestRender();
              },
            };
          },
          {
            overlay: true,
            overlayOptions: {
              width: 80,
              anchor: "bottom-left",
              offsetY: -8,
              margin: { top: 2, right: 2, bottom: 4, left: 2 },
            },
          },
        );
      } catch (error) {
        clearInterval(spinnerInterval);
        ctx.ui.setStatus("reddit", undefined);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Error: ${errorMessage}`, "error");
      }
    },
  });
}

// Export utility functions for testing
export {
  formatRelativeTime,
  extractScore,
  parseRedditJson,
  SPINNER_FRAMES,
  truncateToWidth,
  visibleWidth,
};
