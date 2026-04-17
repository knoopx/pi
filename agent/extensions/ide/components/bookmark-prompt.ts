import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { Input } from "@mariozechner/pi-tui";
import { buildHelpText, ensureWidth } from "./text-utils";
import { createKeyboardHandler } from "../keyboard";
import {
  borderedLine,
  topBorderWithTitle,
  horizontalSeparator,
  bottomBorder,
} from "./ui/frame";
import { fuzzySort } from "../../../shared/fuzzy";

function filterBookmarks(bookmarks: string[], query: string): string[] {
  return fuzzySort(bookmarks, query, (b) => b);
}

export function createBookmarkPromptComponent(
  pi: ExtensionAPI,
  tui: { requestRender: () => void },
  theme: Theme,
  done: (result: string | null) => void,
  cwd: string,
): Component {
  return new BookmarkPrompt(pi, tui, theme, done, cwd);
}

class BookmarkPrompt implements Component {
  private input = new Input();
  private selectedIndex = 0;
  private loading = true;
  private error: string | null = null;
  private bookmarks: string[] = [];

  constructor(
    private pi: ExtensionAPI,
    private tui: { requestRender: () => void },
    private theme: Theme,
    private done: (result: string | null) => void,
    private cwd: string,
  ) {
    this.input.focused = true;
    void this.loadBookmarks();
  }

  // ── Data loading ────────────────────────────────────────────────────────

  async loadBookmarks(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      this.tui.requestRender();

      const result = await this.pi.exec(
        "jj",
        ["bookmark", "list", "-T", 'self.name() ++ "\\n"'],
        { cwd: this.cwd },
      );

      if (result.code !== 0) {
        this.error = result.stderr || "Failed to load bookmarks";
        this.bookmarks = [];
        return;
      }

      const seen = new Set<string>();
      const loaded: string[] = [];

      for (const line of result.stdout.split("\n")) {
        const name = line.trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        loaded.push(name);
      }

      this.bookmarks = loaded;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.bookmarks = [];
    } finally {
      this.loading = false;
      this.tui.requestRender();
    }
  }

  getCandidates(): string[] {
    const query = this.input.getValue().trim();
    const filtered = filterBookmarks(this.bookmarks, query);
    if (filtered.length > 0) return filtered;
    if (query.length > 0) return [query];
    return [];
  }

  // ── Rendering helpers ───────────────────────────────────────────────────

  private renderFooter(innerWidth: number, helpParts: string[]): string[] {
    const helpText = buildHelpText(...helpParts);
    return [
      horizontalSeparator(this.theme, innerWidth),
      borderedLine(
        this.theme,
        ` ${this.theme.fg("dim", helpText)}`,
        innerWidth,
      ),
      bottomBorder(this.theme, innerWidth),
    ];
  }

  private renderEmptyState(
    innerWidth: number,
    state: "loading" | "error" | "empty",
    detail?: string,
    footerHelp?: string[],
  ): string[] {
    const lines: string[] = [];

    if (state === "loading") {
      lines.push(
        borderedLine(
          this.theme,
          this.theme.fg("dim", " Loading bookmarks..."),
          innerWidth,
        ),
      );
      lines.push(borderedLine(this.theme, "", innerWidth));
      lines.push(
        ...this.renderFooter(
          innerWidth,
          footerHelp ?? ["enter set", "↑↓ nav", "esc cancel"],
        ),
      );
    } else if (state === "error") {
      lines.push(
        borderedLine(
          this.theme,
          this.theme.fg("error", ` Error: ${detail}`),
          innerWidth,
        ),
      );
      lines.push(borderedLine(this.theme, "", innerWidth));
      lines.push(...this.renderFooter(innerWidth, ["esc cancel"]));
    } else {
      lines.push(
        borderedLine(
          this.theme,
          this.theme.fg(
            "dim",
            detail ?? " No bookmarks yet. Type to create one.",
          ),
          innerWidth,
        ),
      );
      lines.push(borderedLine(this.theme, "", innerWidth));
      lines.push(
        ...this.renderFooter(
          innerWidth,
          footerHelp ?? ["type bookmark", "enter set", "esc cancel"],
        ),
      );
    }

    return lines;
  }

  private renderCandidateRows(
    candidates: string[],
    innerWidth: number,
    query: string,
  ): string[] {
    const lines: string[] = [];
    const maxVisible = 5;
    let startIdx = 0;
    if (this.selectedIndex >= maxVisible)
      startIdx = this.selectedIndex - maxVisible + 1;

    const visibleCount = Math.min(maxVisible, candidates.length - startIdx);

    for (let i = 0; i < visibleCount; i++) {
      const idx = startIdx + i;
      const candidate = candidates[idx];
      const isFocused = idx === this.selectedIndex;

      const isCreateOption =
        query.length > 0 &&
        candidate === query &&
        !this.bookmarks.includes(candidate);

      let rowContent: string;
      if (isCreateOption) {
        const icon = this.theme.fg("warning", "󰐕");
        const label = this.theme.fg("warning", "new");
        rowContent = ` ${icon} ${label} ${candidate}`;
      } else {
        rowContent = ` 󰃀 ${candidate}`;
      }

      if (isFocused) {
        const focusedContent = this.theme.fg(
          "accent",
          this.theme.bold(rowContent),
        );
        lines.push(
          borderedLine(
            this.theme,
            this.theme.bg(
              "selectedBg",
              ensureWidth(focusedContent, innerWidth),
            ),
            innerWidth,
          ),
        );
      } else {
        lines.push(borderedLine(this.theme, rowContent, innerWidth));
      }
    }

    for (let i = visibleCount; i < maxVisible; i++) {
      lines.push(borderedLine(this.theme, "", innerWidth));
    }

    if (candidates.length > maxVisible) {
      const countText = this.theme.fg(
        "dim",
        ` ${this.selectedIndex + 1}/${candidates.length}`,
      );
      lines.push(borderedLine(this.theme, countText, innerWidth));
    }

    return lines;
  }

  // ── Component interface ────────────────────────────────────────────────

  render(width: number): string[] {
    const lines: string[] = [];
    const innerWidth = width - 2;
    const query = this.input.getValue().trim();

    lines.push(topBorderWithTitle(this.theme, " Set Bookmark ", innerWidth));

    const inputValue = this.input.getValue();
    const cursor = this.theme.fg("accent", "▏");
    lines.push(
      borderedLine(this.theme, ` 󰃀  ${inputValue}${cursor}`, innerWidth),
    );
    lines.push(horizontalSeparator(this.theme, innerWidth));

    if (this.loading)
      return [...lines, ...this.renderEmptyState(innerWidth, "loading")];
    if (this.error)
      return [
        ...lines,
        ...this.renderEmptyState(innerWidth, "error", this.error),
      ];

    const candidates = this.getCandidates();
    this.selectedIndex = Math.min(
      this.selectedIndex,
      Math.max(0, candidates.length - 1),
    );

    if (candidates.length === 0) {
      return [...lines, ...this.renderEmptyState(innerWidth, "empty")];
    }

    lines.push(...this.renderCandidateRows(candidates, innerWidth, query));
    lines.push(
      ...this.renderFooter(innerWidth, [
        "↑↓ nav",
        "enter select/create",
        "esc cancel",
      ]),
    );
    return lines;
  }

  private keyboardHandler = createKeyboardHandler({
    navigation: () => ({
      index: this.selectedIndex,
      maxIndex: Math.max(0, this.getCandidates().length - 1),
    }),
    onNavigate: (newIndex) => {
      this.selectedIndex = newIndex;
      this.tui.requestRender();
    },
    onEscape: () => {
      this.done(null);
    },
    onEnter: () => {
      const candidates = this.getCandidates();
      if (candidates.length === 0) {
        this.done(null);
        return;
      }
      this.done(candidates[this.selectedIndex] || null);
    },
  });

  handleInput(data: string): void {
    if (this.keyboardHandler(data)) return;

    const before = this.input.getValue();
    this.input.handleInput(data);
    if (before !== this.input.getValue()) this.selectedIndex = 0;
    this.tui.requestRender();
  }

  invalidate(): void {
    this.input.invalidate();
  }

  dispose(): void {}
}
