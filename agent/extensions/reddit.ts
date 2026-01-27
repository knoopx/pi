/**
 * Reddit extension - see the [new top hot rising] posts from a subreddit.
 *
 * Usage:
 *   /reddit subreddit [hot|new|top|rising] [limit]
 *   /reddit programming
 *   /reddit peloton new 5
 *
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth, type TUI } from "@mariozechner/pi-tui";
import { spawn } from "child_process";

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
function parseRedditJson(json: string, requestedFeedType: string): JSONParseResult | null {
    try {
        const response = JSON.parse(json);

        // Check for error responses (e.g., banned subreddit, not found)
        if (response.reason || response.error) {
            throw new Error(`Reddit error: ${response.message || response.reason || `HTTP ${response.error}`}`);
        }

        if (response.kind !== "Listing" || !response.data || !Array.isArray(response.data.children)) {
            throw new Error("Invalid Reddit API response format");
        }

        // Get subreddit from the first post
        const firstPost = response.data.children[0]?.data;
        const subreddit = firstPost?.subreddit || "unknown";

        // Parse posts
        const posts: RedditPost[] = response.data.children.map((child: any) => {
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
        return null;
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
    signal?: AbortSignal
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
        spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
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
        } else if (matchesKey(data, "pageup") || matchesKey(data, "ctrl+b")) {
            const jumpAmount = Math.max(1, Math.floor(this.postsToShow.length / 3));
            this.selectedIndex = Math.max(0, this.selectedIndex - jumpAmount);
            this.scrollToSelected();
            this.invalidate();
            this.tui.requestRender();
        } else if (matchesKey(data, "pagedown") || matchesKey(data, "ctrl+f") || matchesKey(data, " ")) {
            const jumpAmount = Math.max(1, Math.floor(this.postsToShow.length / 3));
            this.selectedIndex = Math.min(this.postsToShow.length - 1, this.selectedIndex + jumpAmount);
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
        const postEnd = this.selectedIndex < postLineIndices.length - 1
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
        lines.push(` ${th.fg("accent", `r/${this.result.subreddit} · ${this.result.feedType}`)}`);
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
    private createPostLines(post: RedditPost, boxWidth: number = 78, isSelected: boolean = false): string[] {
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
            lines.push(marker + th.fg("border", "│") + styledTitle + " ".repeat(Math.max(0, innerWidth - visibleWidth(titleLine))) + th.fg("border", "│"));
        }

        // Empty line
        lines.push(th.fg("border", " │") + " ".repeat(boxWidth - 3) + th.fg("border", "│"));

        // Bottom info line: author + time on left, upvotes on right
        const authorTime = `${post.author} · ${formatRelativeTime(post.published)}`;
        const upvotes = post.score > 0 ? `▲ ${post.score}` : "▲ -";
        const middleSpace = innerWidth - visibleWidth(authorTime) - visibleWidth(upvotes);

        if (middleSpace >= 2) {
            const styledUpvotes = isSelected ? th.fg("accent", upvotes) : upvotes;
            lines.push(marker + th.fg("border", "│") + authorTime + " ".repeat(middleSpace) + styledUpvotes + th.fg("border", "│"));
        } else {
            const authorPadded = authorTime.padEnd(innerWidth);
            lines.push(marker + th.fg("border", "│") + authorPadded + th.fg("border", "│"));
            const upvotesPadded = upvotes.padStart(innerWidth);
            const styledUpvotesPadded = isSelected ? th.fg("accent", upvotesPadded) : upvotesPadded;
            lines.push(marker + th.fg("border", "│") + styledUpvotesPadded + th.fg("border", "│"));
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
        const visibleLines = allLines.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleLines);
        const th = this.theme;

        // Build box around visible content
        const result: string[] = [];
        const innerW = Math.max(1, width - 2);
        const padLine = (s: string) => truncateToWidth(s, innerW, "...", true);

        const title = truncateToWidth(` Reddit: ${this.postsToShow.length} posts `, innerW);
        const titlePad = Math.max(0, innerW - visibleWidth(title));

        result.push(th.fg("border", "╭") + th.fg("accent", title) + th.fg("border", "─".repeat(titlePad) + "╮"));

        // Scroll indicators
        const canScrollUp = this.scrollOffset > 0;
        const canScrollDown = this.scrollOffset < allLines.length - this.maxVisibleLines;
        const scrollInfo = `↑${this.scrollOffset}/${allLines.length}↓`;

        if (canScrollUp || canScrollDown) {
            result.push(th.fg("border", "│") + padLine(th.fg("dim", ` ${scrollInfo}`)) + th.fg("border", "│"));
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
        description:
            "Display Reddit posts",
        handler: async (args, ctx) => {
            const parts = args?.split(/\s+/) || [];
            const subreddit = parts[0] || "programming";
            const feedType = parts[1] || "hot";
            const limit = Math.min(25, Math.max(1, parseInt(parts[2], 10) || 5));

            // Show loading status with spinner
            ctx.ui.setStatus("reddit", `${SPINNER_FRAMES[0]} Loading r/${subreddit}...`);

            // Animate spinner
            let frame = 0;
            const spinnerInterval = setInterval(() => {
                frame = (frame + 1) % SPINNER_FRAMES.length;
                ctx.ui.setStatus("reddit", `${SPINNER_FRAMES[frame]} Loading r/${subreddit}...`);
            }, 80);

            try {
                const fetchResult = await fetchRedditPosts(subreddit, feedType, undefined, limit);

                clearInterval(spinnerInterval);
                ctx.ui.setStatus("reddit", undefined); // Clear status

                const { result, source } = fetchResult;

                // Show notification with count and source
                ctx.ui.notify(
                    `r/${result.subreddit}: ${result.posts.length} ${result.feedType} posts (${source.toUpperCase()})`,
                    "success"
                );

                // Display posts in a scrollable overlay above the input line
                await ctx.ui.custom<void>((tui, theme, _kb, done) => {
                    const component = new RedditPostsComponent(result, limit, theme, tui, () => done());
                    return {
                        render: (w) => component.render(w),
                        invalidate: () => component.invalidate(),
                        handleInput: (data) => { component.handleInput(data); tui.requestRender(); },
                    };
                }, {
                    overlay: true,
                    overlayOptions: {
                        width: 80,
                        height: 80,
                        anchor: "bottom-left",
                        offsetY: -8,
                        margin: { top: 2, right: 2, bottom: 4, left: 2 },
                    },
                });
            } catch (error) {
                clearInterval(spinnerInterval);
                ctx.ui.setStatus("reddit", undefined);
                const errorMessage = error instanceof Error ? error.message : String(error);
                ctx.ui.notify(`Error: ${errorMessage}`, "error");
            }
        },
    });
}
