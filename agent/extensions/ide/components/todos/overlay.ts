import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createTodosComponent } from "./component";
import type { TodoItem } from "./types";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

export async function openTodosBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await ctx.ui.custom<TodoItem | null>(
    (tui, theme, keybindings, done) =>
      createTodosComponent({
        pi,
        tui,
        theme,
        keybindings,
        done,
        initialQuery,
        cwd: ctx.cwd,
      }),
    OVERLAY_OPTIONS,
  );

  if (result) {
    const currentText = ctx.ui.getEditorText();
    ctx.ui.setEditorText(
      `${currentText}${result.path}:${String(result.startLine)} ${result.text}`,
    );
  }
}
