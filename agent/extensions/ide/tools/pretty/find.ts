import type { Theme } from "@earendil-works/pi-coding-agent";
import { renderFindResults } from "../renderers";
import { countLines } from "./utils";
import { createPrettyTool } from "./factory";

interface FindParams {
  pattern: string;
  path?: string;
  limit?: number;
}

const { createExecute, createRenderCall, createRenderResult } =
  createPrettyTool<FindParams>({
    toolName: "find",
    detailType: "findResult",
    renderContent: renderFindResults,
    footerFn: (d, theme) => theme.fg("dim", `${String(d.matchCount)} files`),
    detailBuilder: (textContent, p) => ({
      _type: "findResult" as const,
      text: textContent,
      pattern: p.pattern ?? "",
      matchCount: countLines(textContent),
    }),
  });

export { createExecute as createFindExecute };
export { createRenderCall as createFindRenderCall };
export { createRenderResult as createFindRenderResult };
