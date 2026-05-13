import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import {
  createExecuteWrapper,
  buildRenderCall,
  buildRenderResult,
  type ToolExecuteFn,
  type WrappedToolHandler,
} from "./utils";
import type { ToolRenderContext } from "./types";

interface PrettyToolConfig<Params> {
  toolName: string;
  detailType: string;
  renderContent: (text: string, theme: Theme) => string | Promise<string>;
  footerFn: (d: Record<string, unknown>, theme: Theme) => string;
  detailBuilder: (
    textContent: string,
    params: Params,
  ) => Record<string, unknown>;
  suffix?: (args: Params, theme: Theme) => string;
}

export function createPrettyTool<Params>(config: PrettyToolConfig<Params>) {
  const {
    toolName,
    detailType,
    renderContent,
    footerFn,
    detailBuilder,
    suffix,
  } = config;

  const createExecute = (orig: ToolExecuteFn): WrappedToolHandler<Params> =>
    createExecuteWrapper<Params>((result, textContent, p) => {
      result.details = detailBuilder(textContent, p);
    })(orig);

  const createRenderCall =
    (
      cwd: string,
      home: string,
    ): ((
      args: Params,
      theme: Theme,
      ctx: ToolRenderContext<unknown, Params>,
    ) => Component) =>
    (args, theme, ctx) =>
      buildRenderCall({
        cwd,
        home,
        toolName,
        args,
        theme,
        ctx,
        suffix,
      });

  const createRenderResult = (): ((
    result: AgentToolResult<Record<string, unknown>>,
    options: { expanded: boolean; isPartial: boolean },
    theme: Theme,
    ctx: ToolRenderContext<unknown, Params>,
  ) => Component) =>
    buildRenderResult(toolName, detailType, renderContent, footerFn);

  return { createExecute, createRenderCall, createRenderResult };
}
