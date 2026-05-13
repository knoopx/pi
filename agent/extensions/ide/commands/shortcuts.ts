import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import type { KeyId } from "@earendil-works/pi-tui";
import { openFilesPicker } from "../components/files/overlay";
import { openSymbolsPicker } from "../components/symbols/overlay";
import { openBookmarksBrowser } from "../components/bookmarks/overlay";
import { openOpLogBrowser } from "../components/oplog/overlay";
import { openPullRequestsBrowser } from "../components/pull-requests/overlay";
import { openChangesBrowser } from "../components/changes/overlay";
import { createWorkspacesComponent } from "../components/workspaces/component";
import { FULL_OVERLAY_OPTIONS } from "../lib/ui/overlay";
import { handleSearchCommand } from "./handlers";

interface ShortcutDef {
  key: KeyId;
  description: string;
  handler: (ctx: ExtensionContext) => void;
}

export function registerShortcuts(
  pi: ExtensionAPI,
  promptAndSetBookmark: (
    ctx: ExtensionContext,
    changeId: string,
  ) => Promise<string | null>,
): void {
  const shortcuts: ShortcutDef[] = [
    {
      key: Key.ctrl("t"),
      description: "Open symbol picker",
      handler: (ctx) => {
        void openSymbolsPicker(pi, ctx, "");
      },
    },
    {
      key: Key.ctrl("p"),
      description: "Open file picker",
      handler: (ctx) => {
        void openFilesPicker(pi, ctx, "");
      },
    },
    {
      key: Key.ctrl("b"),
      description: "Open bookmarks browser",
      handler: (ctx) => {
        void openBookmarksBrowser(pi, ctx);
      },
    },
    {
      key: Key.ctrl("j"),
      description: "Open workspaces review",
      handler: (ctx) => {
        void ctx.ui.custom(
          (tui, theme, keybindings, done) =>
            createWorkspacesComponent({
              pi,
              tui,
              theme,
              keybindings,
              done,
              ctx,
            }),
          FULL_OVERLAY_OPTIONS,
        );
      },
    },
    {
      key: Key.ctrl("k"),
      description: "Open changes browser",
      handler: (ctx) => {
        void openChangesBrowser(pi, ctx, async (cid) =>
          promptAndSetBookmark(ctx, cid),
        );
      },
    },
    {
      key: Key.ctrl("o"),
      description: "Open operation log browser",
      handler: (ctx) => {
        void openOpLogBrowser(pi, ctx);
      },
    },
    {
      key: Key.ctrl("g"),
      description: "Open pull requests browser",
      handler: (ctx) => {
        void openPullRequestsBrowser(pi, ctx);
      },
    },
    {
      key: Key.ctrlShift("f"),
      description: "Open project-wide search",
      handler: (ctx) => {
        void handleSearchCommand(pi, "", ctx);
      },
    },
  ];

  for (const shortcut of shortcuts) {
    pi.registerShortcut(shortcut.key, {
      description: shortcut.description,
      handler(ctx) {
        if (!ctx.hasUI) return;
        shortcut.handler(ctx);
      },
    });
  }
}
