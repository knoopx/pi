import type {
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { renderTextToolResult } from "../../../shared/rendering/render-utils";

export function createTextResultRender() {
  return function renderResult(
    result: AgentToolResult<unknown>,
    _options: ToolRenderResultOptions,
    theme: Theme,
  ) {
    return renderTextToolResult(result, theme);
  };
}

export function createListRenderCall(toolName: string) {
  return function renderCall(args: Record<string, unknown>, theme: Theme) {
    return createGithubRenderCallContent(toolName, args, theme, (a) => {
      let text = "";
      const owner = typeof a.owner === "string" ? a.owner : undefined;
      const repo = typeof a.repo === "string" ? a.repo : undefined;
      if (owner && repo) text += theme.fg("muted", ` ${owner}/${repo}`);
      const state = typeof a.state === "string" ? a.state : undefined;
      if (state) text += theme.fg("dim", ` --state=${state}`);
      return text;
    });
  };
}

export function createCreateRenderCall(toolName: string) {
  return function renderCall(args: unknown, theme: Theme) {
    const typedArgs = args as { title?: string };
    let text = theme.fg("toolTitle", theme.bold(toolName));
    if (typedArgs.title)
      text += theme.fg("muted", ` "${String(typedArgs.title)}"`);
    return new Text(text, 0, 0);
  };
}

export function createViewRenderCall(toolName: string) {
  return function renderCall(args: Record<string, unknown>, theme: Theme) {
    return createGithubRenderCallContent(toolName, args, theme, (a) => {
      const owner = typeof a.owner === "string" ? a.owner : undefined;
      const repo = typeof a.repo === "string" ? a.repo : undefined;
      const number =
        typeof a.number === "number" || typeof a.number === "string"
          ? String(a.number)
          : undefined;
      if (owner && repo && number)
        return theme.fg("muted", ` ${owner}/${repo}#${number}`);
      return "";
    });
  };
}

function createGithubRenderCallContent(
  toolName: string,
  args: Record<string, unknown>,
  theme: Theme,
  formatArgs: (args: Record<string, unknown>, theme: Theme) => string,
) {
  const text =
    theme.fg("toolTitle", theme.bold(toolName)) + formatArgs(args, theme);
  return new Text(text, 0, 0);
}
