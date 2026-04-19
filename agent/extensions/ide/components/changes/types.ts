import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@mariozechner/pi-coding-agent";

interface ComponentTui {
  terminal: { rows: number };
  requestRender: () => void;
}

interface ChangesComponentInit {
  pi: ExtensionAPI;
  tui: ComponentTui;
  theme: Theme;
  ctx: ExtensionContext;
}

export interface ChangesComponentAPI {
  render: (w: number) => string[];
  handleInput: (d: string) => void;
  invalidate: () => void;
  dispose: () => void;
}

interface ChangesCallbacks {
  done: () => void;
  onNotify?: (text: string) => void;
  onBookmark?: (changeId: string) => Promise<string | null>;
  onFileCmAction?: (
    path: string,
    action: "inspect" | "deps" | "used-by",
  ) => void;
}

export type ChangesComponentFactory = (
  init: ChangesComponentInit & Record<string, unknown>,
  callbacks: ChangesCallbacks,
) => ChangesComponentAPI;

interface RevisionFilter {
  name: string;
  revision: string;
}

export const REVISION_FILTERS: RevisionFilter[] = [
  { name: "Stack", revision: "ancestors(@) ~ root()" },
  { name: "Mine", revision: "mine()" },
  { name: "Tracked", revision: "bookmarks()" },
  { name: "Recent", revision: "committer_date(after:'30 days ago')" },
];

export function buildGraphInput(
  changes: { changeId: string; parentIds?: string[] }[],
  currentChangeId: string | null,
): { id: string; parentIds: string[]; isWorkingCopy: boolean }[] {
  const changeIdSet = new Set(changes.map((c) => c.changeId));
  return changes.map((c) => ({
    id: c.changeId,
    parentIds: (c.parentIds ?? []).filter((pid) => changeIdSet.has(pid)),
    isWorkingCopy: currentChangeId !== null && c.changeId === currentChangeId,
  }));
}
