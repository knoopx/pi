import type { Theme } from "@earendil-works/pi-coding-agent";
import { renderTree } from "../renderers";
import { countLines } from "./utils";
import { createPrettyTool } from "./factory";

interface LsParams {
  path?: string;
  limit?: number;
}

const { createExecute, createRenderCall, createRenderResult } =
  createPrettyTool<LsParams>({
    toolName: "ls",
    detailType: "lsResult",
    renderContent: renderTree,
    footerFn: (d, theme) => theme.fg("dim", `${String(d.entryCount)} entries`),
    detailBuilder: (textContent, p) => ({
      _type: "lsResult" as const,
      text: textContent,
      path: p.path ?? "",
      entryCount: countLines(textContent),
    }),
    suffix: (a, t) =>
      ` ${t.fg("accent", (a as { path?: string }).path ?? ".")}`,
  });

export { createExecute as createLsExecute };
export { createRenderCall as createLsRenderCall };
export { createRenderResult as createLsRenderResult };
