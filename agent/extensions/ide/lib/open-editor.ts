import { spawnSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

function parseFilePath(filePath: string): {
  path: string;
  line?: number;
} {
  const match = filePath.match(/^(.+?):(\d+)$/);
  if (!match) return { path: filePath };
  return { path: match[1], line: parseInt(match[2], 10) };
}

export async function openEditor(
  tui: TUI,
  ctx: ExtensionContext,
  filePath: string,
): Promise<void> {
  if (!ctx.hasUI) return;
  const { isAbsolute, join } = await import("node:path");
  const { path: targetPath, line } = parseFilePath(filePath);
  const fullPath = isAbsolute(targetPath)
    ? targetPath
    : join(ctx.cwd, targetPath);
  const editor = process.env.EDITOR;
  if (!editor) throw new Error("EDITOR environment variable is not set");
  const args: string[] = [];
  if (line !== undefined) {
    args.push(`+${line}`);
  }
  args.push(fullPath);

  tui.stop();
  process.stdout.write("\x1b[2J\x1b[H");
  spawnSync(editor, args, {
    stdio: "inherit",
    env: process.env,
    cwd: ctx.cwd,
  });
  tui.start();
  tui.requestRender(true);
}
