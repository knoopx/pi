import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Input, matchesKey } from "@mariozechner/pi-tui";
import { renderListRows } from "./split-panel";
import { formatBookmarkReference } from "./utils";

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
    const inputRows = input.render(width);

    if (loading) {
      return [...inputRows, theme.fg("dim", " Loading bookmarks...")];
    }

    if (error) {
      return [...inputRows, theme.fg("error", ` Error: ${error}`)];
    }

    const candidates = getCandidates();
    selectedIndex = Math.min(selectedIndex, Math.max(0, candidates.length - 1));

    if (candidates.length === 0) {
      return inputRows;
    }

    const listRows = renderListRows(
      candidates.map((candidate) => ({
        text: formatBookmarkReference(theme, candidate),
      })),
      width,
      8,
      selectedIndex,
      theme,
    );

    return [...inputRows, ...listRows];
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
    dispose() {},
  };
}
