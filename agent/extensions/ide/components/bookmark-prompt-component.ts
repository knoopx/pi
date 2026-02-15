import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Input, matchesKey } from "@mariozechner/pi-tui";
import { renderListRows } from "./split-panel";
import { buildHelpText, pad } from "./utils";

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

function frameRows(theme: Theme, rows: string[], width: number): string[] {
  const innerWidth = Math.max(1, width - 2);
  const top =
    theme.fg("borderAccent", "┌") +
    theme.fg("borderAccent", "─".repeat(innerWidth)) +
    theme.fg("borderAccent", "┐");
  const bottom =
    theme.fg("borderAccent", "└") +
    theme.fg("borderAccent", "─".repeat(innerWidth)) +
    theme.fg("borderAccent", "┘");

  const content = rows.map(
    (row) =>
      theme.fg("borderAccent", "│") +
      pad(row, innerWidth) +
      theme.fg("borderAccent", "│"),
  );

  return [top, ...content, bottom];
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
        [
          "bookmark",
          "list",
          "--all-remotes",
          "-T",
          'self.name() ++ "\\t" ++ coalesce(self.remote(), "") ++ "\\n"',
        ],
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
        const [name, remote] = line.split("\t");
        if (!name) {
          continue;
        }

        const bookmark = remote ? `${name}@${remote}` : `${name}@`;
        if (seen.has(bookmark)) {
          continue;
        }

        seen.add(bookmark);
        loaded.push(bookmark);
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

  function render(width: number): string[] {
    const rows: string[] = [];
    const inputRows = input.render(width);
    const query = input.getValue().trim();

    rows.push(theme.fg("accent", pad(" 󰃀 Bookmark", width)));
    rows.push(...inputRows);

    if (loading) {
      rows.push(theme.fg("dim", pad(" Loading bookmarks...", width)));
      rows.push(
        theme.fg(
          "dim",
          pad(buildHelpText("enter set", "↑↓ nav", "esc cancel"), width),
        ),
      );
      return rows;
    }

    if (error) {
      rows.push(theme.fg("error", pad(` Error: ${error}`, width)));
      rows.push(theme.fg("dim", pad(" Press esc to cancel", width)));
      return rows;
    }

    const candidates = getCandidates();
    selectedIndex = Math.min(selectedIndex, Math.max(0, candidates.length - 1));

    if (candidates.length === 0) {
      rows.push(
        theme.fg("dim", pad(" No bookmarks yet. Type to create one.", width)),
      );
      rows.push(
        theme.fg(
          "dim",
          pad(buildHelpText("type bookmark", "enter set", "esc cancel"), width),
        ),
      );
      return rows;
    }

    const listRows = renderListRows(
      candidates.map((candidate) => {
        const isCreateOption =
          query.length > 0 &&
          candidate === query &&
          !bookmarks.includes(candidate);

        if (isCreateOption) {
          return {
            text: `${theme.fg("warning", "󰐕 new")} ${candidate}`,
          };
        }

        const atIndex = candidate.lastIndexOf("@");
        const name = atIndex >= 0 ? candidate.slice(0, atIndex) : candidate;
        const remote =
          atIndex >= 0 && atIndex < candidate.length - 1
            ? candidate.slice(atIndex + 1)
            : "";

        return {
          text: remote
            ? `󰃀 ${name}${theme.fg("dim", ` @${remote}`)}`
            : `󰃀 ${name}`,
        };
      }),
      width,
      5,
      selectedIndex,
      theme,
    );

    rows.push(...listRows);
    rows.push(
      theme.fg(
        "dim",
        pad(
          buildHelpText("↑↓ nav", "enter select/create", "esc cancel"),
          width,
        ),
      ),
    );

    return rows;
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
