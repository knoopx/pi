import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ChangesState } from "../state";
import type { Change } from "../../../types";
import { notifyMutation } from "../../../jj/core";
import { formatErrorMessage } from "../../../lib/ui/footer";

interface BookmarkOpsContext {
  pi: ExtensionAPI;
  cwd: string;
  state: ChangesState;
  refreshAfterMutation: () => Promise<void>;
  notify: (msg: string, type?: "info" | "error") => void;
  onBookmark?: (changeId: string) => Promise<string | null>;
  loadBookmarksForChanges: (
    changes: Change[],
  ) => Promise<Map<string, string[]>>;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export async function pushBookmarks(ctx: BookmarkOpsContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  const bookmarks = getBookmarksForSelectedChange(ctx.state);
  if (bookmarks.length === 0) return;

  try {
    const outputs = await pushBookmarksToRemote(ctx, bookmarks);
    await ctx.refreshAfterMutation();
    const msg = `Pushed bookmark${pluralize(bookmarks.length, "", "s")}: ${bookmarks.join(", ")}`;
    notifyMutation(ctx.pi, msg, outputs.join("\n"));
  } catch (error) {
    ctx.notify(`Failed to push: ${formatErrorMessage(error)}`, "error");
  }
}

function getBookmarksForSelectedChange(state: ChangesState): string[] {
  if (!state.selectedChange) return [];
  return state.bookmarksByChange.get(state.selectedChange.changeId) ?? [];
}

async function pushBookmarksToRemote(
  ctx: BookmarkOpsContext,
  bookmarks: string[],
): Promise<string[]> {
  const outputs: string[] = [];
  for (const bookmark of bookmarks) {
    const r = await ctx.pi.exec("jj", ["git", "push", "-b", bookmark], {
      cwd: ctx.cwd,
    });
    outputs.push(r.stderr || r.stdout);
  }
  return outputs;
}

export async function setBookmark(ctx: BookmarkOpsContext): Promise<void> {
  if (!canSetBookmark(ctx)) return;
  try {
    const result = await promptAndApplyBookmark(ctx);
    if (!result) return;
    await reloadBookmarks(ctx);
    notifyBookmarkSet(ctx, result.bookmarkName, result.changeId);
  } catch (error) {
    ctx.notify(
      `Failed to update bookmark: ${formatErrorMessage(error)}`,
      "error",
    );
  }
}

function canSetBookmark(ctx: BookmarkOpsContext): boolean {
  return !!(ctx.state.selectedChange && ctx.onBookmark);
}

async function promptAndApplyBookmark(
  ctx: BookmarkOpsContext,
): Promise<{ bookmarkName: string; changeId: string } | null> {
  const change = ctx.state.selectedChange;
  if (!change || !ctx.onBookmark) return null;
  const bookmarkName = await ctx.onBookmark(change.changeId);
  if (!bookmarkName) return null;
  return { bookmarkName, changeId: change.changeId };
}

function notifyBookmarkSet(
  ctx: BookmarkOpsContext,
  bookmarkName: string,
  changeId: string,
): void {
  const msg = `Updated bookmark '${bookmarkName}' to ${changeId}`;
  notifyMutation(
    ctx.pi,
    msg,
    `Set bookmark '${bookmarkName}' to ${changeId.slice(0, 8)}`,
  );
}

export async function reloadBookmarks(ctx: BookmarkOpsContext): Promise<void> {
  const bookmarksByChange = await ctx.loadBookmarksForChanges(
    ctx.state.changes,
  );
  ctx.state.bookmarksByChange.clear();
  for (const [changeId, bookmarks] of bookmarksByChange) {
    ctx.state.bookmarksByChange.set(changeId, bookmarks);
  }
}
