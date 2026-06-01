import type {
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { renderTextToolResult } from "./render-results";

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
    return createGithubRenderCallContent(toolName, args, theme, (a) =>
      formatListArgs(a, theme),
    );
  };
}

function formatListArgs(a: Record<string, unknown>, theme: Theme): string {
  let text = "";
  const owner = safeString(a.owner);
  const repo = safeString(a.repo);
  if (owner && repo) text += theme.fg("muted", ` ${owner}/${repo}`);
  const state = safeString(a.state);
  if (state) text += theme.fg("dim", ` --state=${state}`);
  return text;
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

function buildViewPath(
  a: Record<string, unknown>,
): { owner: string; repo: string; number: string } | null {
  const { owner, repo, number } = a;
  if (typeof owner === "string" && typeof repo === "string" && typeof number === "number") {
    return { owner, repo, number: String(number) };
  }
  return null;
}

function formatViewArgs(a: Record<string, unknown>, theme: Theme): string {
  const path = buildViewPath(a);
  if (!path) return "";
  return theme.fg("muted", ` ${path.owner}/${path.repo}#${path.number}`);
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function createViewRenderCall(toolName: string) {
  return function renderCall(args: Record<string, unknown>, theme: Theme) {
    return createGithubRenderCallContent(toolName, args, theme, (a) =>
      formatViewArgs(a, theme),
    );
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
