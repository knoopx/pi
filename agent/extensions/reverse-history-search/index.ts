import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { HistoryEntry } from "./types";
import { loadSessionHistoryForCwd } from "./data/loading";
import { makeHistorySearchRenderer } from "./ui/component";

function applyHistoryResult(ctx: ExtensionContext, result: HistoryEntry): void {
  const content = result.content.trim().replace(/\n+$/, "");
  if (result.type === "command") {
    ctx.ui.setEditorText(`!${content}`);
  } else {
    ctx.ui.setEditorText(content);
  }
}

export default function (pi: ExtensionAPI): void {
  pi.registerShortcut("ctrl+r", {
    description:
      "Reverse history search (user messages and commands from sessions in current directory)",
    async handler(ctx: ExtensionContext) {
      if (!ctx.hasUI) return;
      const history = loadSessionHistoryForCwd(ctx.cwd);
      if (history.length === 0) {
        ctx.ui.notify("No history found", "warning");
        return;
      }
      const result = await ctx.ui.custom<HistoryEntry | null>(
        (tuiRef, themeRef, _kb, doneRef) =>
          makeHistorySearchRenderer(themeRef, history, doneRef, tuiRef),
      );

      if (!result) return;
      applyHistoryResult(ctx, result);
    },
  });
}
