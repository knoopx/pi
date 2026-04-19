import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

export async function openEditor(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  filePath: string,
): Promise<void> {
  if (!ctx.hasUI) return;

  const { createEditorComponent } =
    await import("../components/editor/component");
  const { isAbsolute, join } = await import("node:path");
  const { readFileSync } = await import("node:fs");

  const match = filePath.match(/^(.+?):(\d+)$/);
  const targetPath = match ? match[1] : filePath;
  const targetLine = match ? parseInt(match[2], 10) - 1 : undefined;

  const fullPath = isAbsolute(targetPath)
    ? targetPath
    : join(ctx.cwd, targetPath);

  let content = "";
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  await ctx.ui.custom((tui, theme, _keybindings, done) => {
    return createEditorComponent({
      pi,
      tui,
      theme,
      done,
      filePath: fullPath,
      content,
      cursorLine: targetLine,
    });
  }, OVERLAY_OPTIONS);
}
