import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  detectGlobs,
  extractFileFilter,
  formatGlobResult,
  runTree,
} from "./lib/path-injection";

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };
    const globs = await detectGlobs(event.text, ctx.cwd);
    if (globs.length === 0) return { action: "continue" };

    const enriched = await Promise.all(
      globs.map(async (g) => {
        const filter = extractFileFilter(g.pattern);
        const trees = (
          await Promise.all(
            g.directories.map(async (d) => {
              const output = await runTree(d, filter);
              return output ? { path: d, output } : null;
            }),
          )
        ).filter((r): r is { path: string; output: string } => r !== null);
        return { ...g, trees };
      }),
    );

    const content = formatGlobResult(enriched);
    if (!content) return { action: "continue" };

    pi.sendMessage({
      customType: "path-tree",
      content,
      display: true,
    });
    ctx.ui.notify("Injected path tree for glob patterns", "info");

    return { action: "continue" };
  });
}
