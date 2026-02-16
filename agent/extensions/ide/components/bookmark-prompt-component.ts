import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Input, matchesKey } from "@mariozechner/pi-tui";
import { buildHelpText, ensureWidth } from "./utils";
import {
  borderedLine,
  topBorderWithTitle,
  horizontalSeparator,
  bottomBorder,
} from "./shared-utils";

function fuzzyScore(candidate: string, query: string): number {
  const text = candidate.toLowerCase();
  const q = query.toLowerCase();

  if (!q) {
    return 1;
  }

  const containsIndex = text.indexOf(q);
  if (containsIndex >= 0) {
    return 1000 - containsIndex;
  }

  let qi = 0;
  let score = 0;
  let lastMatch = -1;

  for (let i = 0; i < text.length && qi < q.length; i++) {
    if (text[i] === q[qi]) {
      score += lastMatch >= 0 ? Math.max(1, 8 - (i - lastMatch)) : 8;
      lastMatch = i;
      qi++;
    }
  }

  return qi === q.length ? score : -1;
}

function filterBookmarks(bookmarks: string[], query: string): string[] {
  if (!query) {
    return bookmarks;
  }

  return bookmarks
    .map((bookmark) => ({ bookmark, score: fuzzyScore(bookmark, query) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.bookmark);
}

export function createBookmarkPromptComponent(
  pi: ExtensionAPI,
  tui: { requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: string | null) => void,
  _changeId: string,
  cwd: string,
) {
  const input = new Input();
  input.focused = true;

  let selectedIndex = 0;
  let loading = true;
  let error: string | null = null;
  let bookmarks: string[] = [];

  async function loadBookmarks(): Promise<void> {
    try {
      loading = true;
      error = null;
      tui.requestRender();

      const result = await pi.exec(
        "jj",
        ["bookmark", "list", "-T", 'self.name() ++ "\\n"'],
        { cwd },
      );

      if (result.code !== 0) {
        error = result.stderr || "Failed to load bookmarks";
        bookmarks = [];
        return;
      }

      const seen = new Set<string>();
      const loaded: string[] = [];

      for (const line of result.stdout.split("\n")) {
        const name = line.trim();
        if (!name || seen.has(name)) {
          continue;
        }
        seen.add(name);
        loaded.push(name);
      }

      bookmarks = loaded;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      bookmarks = [];
    } finally {
      loading = false;
      tui.requestRender();
    }
  }

  function getCandidates(): string[] {
    const query = input.getValue().trim();
    const filtered = filterBookmarks(bookmarks, query);

    if (filtered.length > 0) {
      return filtered;
    }

    if (query.length > 0) {
      return [query];
    }

    return [];
  }

  function renderFooter(innerWidth: number, helpParts: string[]): string[] {
    const helpText = buildHelpText(...helpParts);
    return [
      horizontalSeparator(theme, innerWidth),
      borderedLine(theme, ` ${theme.fg("dim", helpText)}`, innerWidth),
      bottomBorder(theme, innerWidth),
    ];
  }

  function render(width: number): string[] {
    const lines: string[] = [];
    const innerWidth = width - 2;
    const query = input.getValue().trim();

    // Top border with title
    lines.push(topBorderWithTitle(theme, " Set Bookmark ", innerWidth));

    // Input row with icon
    const inputIcon = "󰃀";
    const inputValue = input.getValue();
    const cursor = theme.fg("accent", "▏");
    const inputContent = ` ${inputIcon}  ${inputValue}${cursor}`;
    lines.push(borderedLine(theme, inputContent, innerWidth));

    // Separator
    lines.push(horizontalSeparator(theme, innerWidth));

    if (loading) {
      lines.push(
        borderedLine(
          theme,
          theme.fg("dim", " Loading bookmarks..."),
          innerWidth,
        ),
      );
      lines.push(borderedLine(theme, "", innerWidth));
      lines.push(
        ...renderFooter(innerWidth, ["enter set", "↑↓ nav", "esc cancel"]),
      );
      return lines;
    }

    if (error) {
      lines.push(
        borderedLine(theme, theme.fg("error", ` Error: ${error}`), innerWidth),
      );
      lines.push(borderedLine(theme, "", innerWidth));
      lines.push(...renderFooter(innerWidth, ["esc cancel"]));
      return lines;
    }

    const candidates = getCandidates();
    selectedIndex = Math.min(selectedIndex, Math.max(0, candidates.length - 1));

    if (candidates.length === 0) {
      lines.push(
        borderedLine(
          theme,
          theme.fg("dim", " No bookmarks yet. Type to create one."),
          innerWidth,
        ),
      );
      lines.push(borderedLine(theme, "", innerWidth));
      lines.push(
        ...renderFooter(innerWidth, [
          "type bookmark",
          "enter set",
          "esc cancel",
        ]),
      );
      return lines;
    }

    // Render candidates list (max 5 visible)
    const maxVisible = 5;
    let startIdx = 0;
    if (selectedIndex >= maxVisible) {
      startIdx = selectedIndex - maxVisible + 1;
    }

    const visibleCount = Math.min(maxVisible, candidates.length - startIdx);

    for (let i = 0; i < visibleCount; i++) {
      const idx = startIdx + i;
      const candidate = candidates[idx];
      const isFocused = idx === selectedIndex;

      const isCreateOption =
        query.length > 0 &&
        candidate === query &&
        !bookmarks.includes(candidate);

      let rowContent: string;
      if (isCreateOption) {
        const icon = theme.fg("warning", "󰐕");
        const label = theme.fg("warning", "new");
        rowContent = ` ${icon} ${label} ${candidate}`;
      } else {
        rowContent = ` 󰃀 ${candidate}`;
      }

      if (isFocused) {
        const focusedContent = theme.fg("accent", theme.bold(rowContent));
        lines.push(
          borderedLine(
            theme,
            theme.bg("selectedBg", ensureWidth(focusedContent, innerWidth)),
            innerWidth,
          ),
        );
      } else {
        lines.push(borderedLine(theme, rowContent, innerWidth));
      }
    }

    // Fill remaining slots if less than maxVisible
    for (let i = visibleCount; i < maxVisible; i++) {
      lines.push(borderedLine(theme, "", innerWidth));
    }

    // Scroll indicator
    if (candidates.length > maxVisible) {
      const countText = theme.fg(
        "dim",
        ` ${selectedIndex + 1}/${candidates.length}`,
      );
      lines.push(borderedLine(theme, countText, innerWidth));
    }

    lines.push(
      ...renderFooter(innerWidth, [
        "↑↓ nav",
        "enter select/create",
        "esc cancel",
      ]),
    );
    return lines;
  }

  function handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      done(null);
      return;
    }

    if (matchesKey(data, "up")) {
      selectedIndex = Math.max(0, selectedIndex - 1);
      tui.requestRender();
      return;
    }

    if (matchesKey(data, "down")) {
      const candidates = getCandidates();
      if (candidates.length === 0) {
        tui.requestRender();
        return;
      }
      selectedIndex = Math.min(candidates.length - 1, selectedIndex + 1);
      tui.requestRender();
      return;
    }

    if (matchesKey(data, "enter")) {
      const candidates = getCandidates();
      if (candidates.length === 0) {
        done(null);
        return;
      }
      done(candidates[selectedIndex] || null);
      return;
    }

    const before = input.getValue();
    input.handleInput(data);
    const after = input.getValue();
    if (before !== after) {
      selectedIndex = 0;
    }
    tui.requestRender();
  }

  void loadBookmarks();

  return {
    render,
    handleInput,
    invalidate() {
      input.invalidate();
    },
    dispose() {
      return;
    },
  };
}
