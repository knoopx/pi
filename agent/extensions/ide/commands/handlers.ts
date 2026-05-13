import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createFooter } from "../lib/ui/footer";
import { createNewChange } from "../jj/changes";
import { openFilesPicker } from "../components/files/overlay";
import { openSymbolsPicker } from "../components/symbols/overlay";
import { openBookmarksBrowser } from "../components/bookmarks/overlay";
import { openOpLogBrowser } from "../components/oplog/overlay";
import { openPullRequestsBrowser } from "../components/pull-requests/overlay";
import { openChangesBrowser } from "../components/changes/overlay";
import { openTodosBrowser } from "../components/todos/overlay";
import { openSearchPicker } from "../components/search/overlay";

export function handleSessionStart(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  const footer = createFooter(pi, ctx);
  footer.register();
  void footer.refresh();

  void createNewChange(pi, ctx.cwd)
    .then((changeResult) => {
      handleCreateChangeResult(changeResult, ctx);
    })
    .catch((error) => {
      ctx.ui.notify(
        `Failed to create jj change: ${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    });
}

export function handleModelSelect(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  const footer = createFooter(pi, ctx);
  footer.register();
  void footer.refresh();
}

function notifyChangeResult(opts: {
  success: boolean;
  created: boolean;
  error: string | undefined;
  changeId: string | undefined;
  ui: ExtensionContext["ui"];
}): void {
  if (!opts.success) {
    opts.ui.notify(`Failed to create jj change: ${opts.error}`, "warning");
    return;
  }
  if (opts.created) {
    opts.ui.notify(`New jj change: ${opts.changeId ?? "(no id)"}`, "info");
  }
}

function handleCreateChangeResult(
  changeResult: {
    success: boolean;
    created: boolean;
    error?: string;
    changeId?: string;
  },
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  notifyChangeResult({
    success: changeResult.success,
    created: changeResult.created,
    error: changeResult.error,
    changeId: changeResult.changeId,
    ui: ctx.ui,
  });
}

export function handleSymbolsCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openSymbolsPicker(pi, ctx, args);
}

export function handleFilesCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openFilesPicker(pi, ctx, args);
}

export function handleBookmarksCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openBookmarksBrowser(pi, ctx);
}

export function handleChangeCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  onBookmark: (changeId: string) => Promise<string | null>,
): void {
  if (!ctx.hasUI) return;
  void openChangesBrowser(pi, ctx, onBookmark);
}

export function handleOplogCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openOpLogBrowser(pi, ctx);
}

export function handlePullRequestsCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openPullRequestsBrowser(pi, ctx);
}

export function handleTodosCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openTodosBrowser(pi, ctx, args);
}

export function handleSearchCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openSearchPicker(pi, ctx, args);
}
