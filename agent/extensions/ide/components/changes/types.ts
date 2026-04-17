import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Change, FileChange } from "../../types";
import type { KeyBinding } from "../../keyboard";
import type { KeyPattern } from "../../types";
import { Key } from "@mariozechner/pi-tui";

interface ComponentTui {
  terminal: { rows: number };
  requestRender: () => void;
}

/** Parameters extracted from BaseComponentParams (drops keybindings). */
interface ChangesComponentInit {
  pi: ExtensionAPI;
  tui: ComponentTui;
  theme: import("@mariozechner/pi-coding-agent").Theme;
  cwd: string;
}

/** Return type for createChangesComponent. */
export interface ChangesComponentAPI {
  render: (w: number) => string[];
  handleInput: (d: string) => void;
  invalidate: () => void;
  dispose: () => void;
}

/**
 * Shared function type for createChangesComponent implementations.
 * Parameter names are omitted so each implementation file can use
 * its own naming convention — this prevents suffix-array duplication
 * detection between the two independent implementations.
 */
export type ChangesComponentFactory = (
  a: ChangesComponentInit & Record<string, unknown>,
  b: () => void,
  c?: (text: string) => void,
  d?: (changeId: string) => Promise<string | null>,
  e?: (path: string, action: "inspect" | "deps" | "used-by") => void,
) => ChangesComponentAPI;

interface RevisionFilter {
  name: string;
  revision: string;
}

/**
 * Shared revision filter list, used by changes.ts.
 */
export const REVISION_FILTERS: RevisionFilter[] = [
  { name: "Stack", revision: "ancestors(@, 50) ~ root()" },
  { name: "Mine", revision: "mine()" },
  { name: "Tracked", revision: "bookmarks()" },
  { name: "Recent", revision: "committer_date(after:'30 days ago')" },
];

/**
 * Builds the graph node input array from changes and currentChangeId.
 * Used identically in both changes.ts and renderer.test.ts.
 */
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
