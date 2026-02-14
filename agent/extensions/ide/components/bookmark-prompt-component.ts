import type { KeybindingsManager, Theme } from "@mariozechner/pi-coding-agent";
import { Input, matchesKey } from "@mariozechner/pi-tui";
import { renderListRows } from "./split-panel";

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
  tui: { requestRender: () => void },
  _theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: string | null) => void,
  _changeId: string,
  bookmarks: string[],
) {
  const input = new Input();
  input.focused = true;

  let selectedIndex = 0;

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
    const candidates = getCandidates();
    selectedIndex = Math.min(selectedIndex, Math.max(0, candidates.length - 1));

    if (candidates.length === 0) {
      return inputRows;
    }

    const listRows = renderListRows(
      candidates.map((candidate) => ({ text: candidate })),
      width,
      8,
      selectedIndex,
      _theme,
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

  return {
    render,
    handleInput,
    invalidate() {
      input.invalidate();
    },
    dispose() {},
  };
}
