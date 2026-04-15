import {
  createReadToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createReadTool,
  createLsTool,
  createFindTool,
  createGrepTool,
} from "@mariozechner/pi-coding-agent";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  FindToolDetails,
  FindToolInput,
  GrepToolDetails,
  GrepToolInput,
  LsToolDetails,
  LsToolInput,
  ReadToolDetails,
  ReadToolInput,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
interface ToolRenderContext<TState, TArgs> {
  args: TArgs;
  toolCallId: string;
  invalidate: () => void;
  lastComponent: Component | undefined;
  state: TState;
  cwd: string;
  executionStarted: boolean;
  argsComplete: boolean;
  isPartial: boolean;
  expanded: boolean;
  showImages: boolean;
  isError: boolean;
}
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import type { ImageContent } from "@mariozechner/pi-ai";
import {
  renderFileContent,
  renderTree,
  renderFindResults,
  renderGrepResults,
} from "./renderers";
import { fileIconGlyph } from "./icons";
import { humanSize } from "./images";
import { MAX_PREVIEW_LINES } from "./shiki-constants";
import { termW, shortPath } from "./utils";
import {
  extractTextContent,
  renderError,
  countLines,
  getTextComponent,
  handleRenderResult,
} from "./pretty-utils";
interface ReadState {
  _rk?: string;
  _rt?: string;
}
interface GrepState {
  _gk?: string;
  _gt?: string;
}
type ReadDetails =
  | ReadToolDetails
  | undefined
  | {
      _type: "readImage" | "readFile";
      filePath: string;
      data?: string;
      mimeType?: string;
      content?: string;
      offset?: number;
      lineCount?: number;
    };
type LsDetails =
  | LsToolDetails
  | undefined
  | {
      _type: "lsResult";
      path?: string;
      text?: string;
      entryCount?: number;
    };
type FindDetails =
  | FindToolDetails
  | undefined
  | {
      _type: "findResult";
      text?: string;
      pattern?: string;
      matchCount?: number;
    };
type GrepDetails =
  | GrepToolDetails
  | undefined
  | {
      _type: "grepResult";
      text?: string;
      pattern?: string;
      matchCount?: number;
    };
export default async function piPrettyExtension(
  pi: ExtensionAPI,
): Promise<void> {
  const createReadToolFn = createReadToolDefinition ?? createReadTool;
  const createLsToolFn = createLsToolDefinition ?? createLsTool;
  const createFindToolFn = createFindToolDefinition ?? createFindTool;
  const createGrepToolFn = createGrepToolDefinition ?? createGrepTool;
  if (!createReadToolFn) return;
  const cwd = process.cwd();
  const home = process.env.HOME ?? "";
  const sp = (p: string): string => shortPath(cwd, home, p);
  const origRead = createReadToolFn(cwd);
  pi.registerTool({
    ...origRead,
    name: "read",
    async execute(
      tid: string,
      params: ReadToolInput,
      sig: AbortSignal | undefined,
      upd: AgentToolUpdateCallback<ReadDetails> | undefined,
      ctx: ExtensionContext,
    ): Promise<AgentToolResult<ReadDetails>> {
      const result = (await origRead.execute(
        tid,
        params,
        sig,
        upd,
        ctx,
      )) as AgentToolResult<ReadDetails>;
      const fp = params.path ?? "";
      const offset = params.offset ?? 1;
      const imageBlock = result.content?.find(
        (c): c is ImageContent => c.type === "image",
      );
      if (imageBlock) {
        result.details = {
          _type: "readImage" as const,
          filePath: fp,
          data: imageBlock.data,
          mimeType: imageBlock.mimeType ?? "image/png",
        };
        return result;
      }
      const textContent = extractTextContent(result.content);
      if (textContent && fp) {
        const lineCount = textContent.split("\n").length;
        result.details = {
          _type: "readFile" as const,
          filePath: fp,
          content: textContent,
          offset,
          lineCount,
        };
      }
      return result;
    },
    renderCall(
      args: ReadToolInput,
      theme: Theme,
      ctx: ToolRenderContext<ReadState, ReadToolInput>,
    ): Component {
      const fp = args?.path ?? "";
      const text = getTextComponent(ctx, Text);
      const offset = args?.offset
        ? ` ${theme.fg("muted", `from line ${args.offset}`)}`
        : "";
      const limit = args?.limit
        ? ` ${theme.fg("muted", `(${args.limit} lines)`)}`
        : "";
      text.setText(
        `${theme.fg("toolTitle", theme.bold("read"))} ${theme.fg(
          "accent",
          sp(fp),
        )}${offset}${limit}`,
      );
      return text;
    },
    renderResult(
      result: AgentToolResult<ReadDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
      ctx: ToolRenderContext<ReadState, ReadToolInput>,
    ): Component {
      const text = getTextComponent(ctx, Text);
      if (ctx.isError) return renderError(result.content, theme, text);
      const d = result.details as unknown as Record<string, unknown>;
      if (d?._type === "readImage") {
        const tw = termW();
        const out: string[] = [];
        const byteSize = Math.ceil(((d.data as string).length * 3) / 4);
        const sizeStr = humanSize(byteSize);
        const mimeStr = (d.mimeType as string) ?? "image";
        out.push(
          `  ${fileIconGlyph(
            d.filePath as string,
          )}${theme.fg("dim", `${mimeStr} · ${sizeStr}`)}`,
        );
        out.push(theme.fg("border", "─".repeat(tw)));
        out.push(theme.fg("border", "─".repeat(tw)));
        text.setText(out.join("\n"));
        return text;
      }
      if (d?._type === "readFile" && d.content) {
        const key = `read:${d.filePath}:${d.offset}:${d.lineCount}:${termW()}`;
        if (ctx.state._rk !== key) {
          ctx.state._rk = key;
          const info = theme.fg("dim", `${d.lineCount} lines`);
          ctx.state._rt = `  ${info}`;
          const maxShow = options.expanded
            ? (d.lineCount as number)
            : MAX_PREVIEW_LINES;
          renderFileContent(
            d.content as string,
            d.filePath as string,
            d.offset as number,
            maxShow,
            theme,
          )
            .then((rendered: string) => {
              if (ctx.state._rk !== key) return;
              ctx.state._rt = `  ${info}\n${rendered}`;
              ctx.invalidate();
            })
            .catch(() => {});
        }
        text.setText(
          ctx.state._rt ?? `  ${theme.fg("dim", `${d.lineCount} lines`)}`,
        );
        return text;
      }
      const fallback = result.content?.[0] as { text?: string } | undefined;
      const fallbackText = fallback?.text ?? "read";
      text.setText(`  ${theme.fg("dim", fallbackText.slice(0, 120))}`);
      return text;
    },
  });
  if (createLsToolFn) {
    const origLs = createLsToolFn(cwd);
    pi.registerTool({
      ...origLs,
      name: "ls",
      async execute(
        tid: string,
        params: LsToolInput,
        sig: AbortSignal | undefined,
        upd: AgentToolUpdateCallback<LsDetails> | undefined,
        ctx: ExtensionContext,
      ): Promise<AgentToolResult<LsDetails>> {
        const result = (await origLs.execute(
          tid,
          params,
          sig,
          upd,
          ctx,
        )) as AgentToolResult<LsDetails>;
        const textContent = extractTextContent(result.content);
        const fp = params.path ?? cwd;
        const entryCount = countLines(textContent);
        result.details = {
          _type: "lsResult" as const,
          text: textContent,
          path: fp,
          entryCount,
        };
        return result;
      },
      renderCall(
        args: LsToolInput,
        theme: Theme,
        ctx: ToolRenderContext<unknown, LsToolInput>,
      ): Component {
        const fp = args?.path ?? ".";
        const text = getTextComponent(ctx, Text);
        text.setText(
          `${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg(
            "accent",
            sp(fp),
          )}`,
        );
        return text;
      },
      renderResult(
        result: AgentToolResult<LsDetails>,
        _options: ToolRenderResultOptions,
        theme: Theme,
        ctx: ToolRenderContext<unknown, LsToolInput>,
      ): Component {
        const text = getTextComponent(ctx, Text);
        return handleRenderResult(
          result,
          ctx,
          theme,
          text,
          (d) => {
            if (d?._type === "lsResult" && d.text) {
              const tree = renderTree(
                d.text as string,
                theme,
              ) as unknown as string[];
              const info = theme.fg("dim", `${d.entryCount} entries`);
              text.setText(`  ${info}\n${tree}`);
              return text;
            }
            return undefined;
          },
          "listed",
        );
      },
    });
  }
  if (createFindToolFn) {
    const origFind = createFindToolFn(cwd);
    pi.registerTool({
      ...origFind,
      name: "find",
      async execute(
        tid: string,
        params: FindToolInput,
        sig: AbortSignal | undefined,
        upd: AgentToolUpdateCallback<FindDetails> | undefined,
        ctx: ExtensionContext,
      ): Promise<AgentToolResult<FindDetails>> {
        const result = (await origFind.execute(
          tid,
          params,
          sig,
          upd,
          ctx,
        )) as AgentToolResult<FindDetails>;
        const textContent = extractTextContent(result.content);
        const matchCount = countLines(textContent);
        result.details = {
          _type: "findResult" as const,
          text: textContent,
          pattern: params.pattern ?? "",
          matchCount,
        };
        return result;
      },
      renderCall(
        args: FindToolInput,
        theme: Theme,
        ctx: ToolRenderContext<unknown, FindToolInput>,
      ): Component {
        const pattern = args?.pattern ?? "";
        const path = args?.path
          ? ` ${theme.fg("muted", `in ${sp(args.path)}`)}`
          : "";
        const text = getTextComponent(ctx, Text);
        text.setText(
          `${theme.fg("toolTitle", theme.bold("find"))} ${theme.fg(
            "accent",
            pattern,
          )}${path}`,
        );
        return text;
      },
      renderResult(
        result: AgentToolResult<FindDetails>,
        _options: ToolRenderResultOptions,
        theme: Theme,
        ctx: ToolRenderContext<unknown, FindToolInput>,
      ): Component {
        const text = getTextComponent(ctx, Text);
        return handleRenderResult(
          result,
          ctx,
          theme,
          text,
          (d) => {
            if (d?._type === "findResult" && d.text) {
              const rendered = renderFindResults(d.text as string, theme);
              const info = theme.fg("dim", `${d.matchCount} files`);
              text.setText(`  ${info}\n${rendered}`);
              return text;
            }
            return undefined;
          },
          "found",
        );
      },
    });
  }
  if (createGrepToolFn) {
    const origGrep = createGrepToolFn(cwd);
    pi.registerTool({
      ...origGrep,
      name: "grep",
      async execute(
        tid: string,
        params: GrepToolInput,
        sig: AbortSignal | undefined,
        upd: AgentToolUpdateCallback<GrepDetails> | undefined,
        ctx: ExtensionContext,
      ): Promise<AgentToolResult<GrepDetails>> {
        const result = (await origGrep.execute(
          tid,
          params,
          sig,
          upd,
          ctx,
        )) as AgentToolResult<GrepDetails>;
        const textContent = extractTextContent(result.content);
        const matchCount = textContent
          ? (() => {
              const lines = textContent.trim().split("\n");
              let count = 0;
              const regex = /^.+?[:\-]\d+[:\-]/;
              for (const l of lines) {
                if (regex.test(l)) count++;
              }
              return count;
            })()
          : 0;
        result.details = {
          _type: "grepResult" as const,
          text: textContent,
          pattern: params.pattern ?? "",
          matchCount,
        };
        return result;
      },
      renderCall(
        args: GrepToolInput,
        theme: Theme,
        ctx: ToolRenderContext<unknown, GrepToolInput>,
      ): Component {
        const pattern = args?.pattern ?? "";
        const path = args?.path
          ? ` ${theme.fg("muted", `in ${sp(args.path)}`)}`
          : "";
        const glob = args?.glob
          ? ` ${theme.fg("muted", `(${args.glob})`)}`
          : "";
        const text = getTextComponent(ctx, Text);
        text.setText(
          `${theme.fg("toolTitle", theme.bold("grep"))} ${theme.fg(
            "accent",
            pattern,
          )}${path}${glob}`,
        );
        return text;
      },
      renderResult(
        result: AgentToolResult<GrepDetails>,
        _options: ToolRenderResultOptions,
        theme: Theme,
        ctx: ToolRenderContext<unknown, GrepToolInput>,
      ): Component {
        const text = getTextComponent(ctx, Text);
        return handleRenderResult(
          result,
          ctx,
          theme,
          text,
          (d) => {
            if (d?._type === "grepResult" && d.text) {
              const key = `grep:${d.pattern}:${d.matchCount}:${termW()}`;
              const state = ctx.state as GrepState;
              if (state._gk !== key) {
                state._gk = key;
                const info = theme.fg("dim", `${d.matchCount} matches`);
                state._gt = `  ${info}`;
                renderGrepResults(d.text as string, d.pattern as string, theme)
                  .then((rendered: string) => {
                    if (state._gk !== key) return;
                    state._gt = `  ${info}\n${rendered}`;
                    ctx.invalidate();
                  })
                  .catch(() => {});
              }
              text.setText(
                state._gt ?? `  ${theme.fg("dim", `${d.matchCount} matches`)}`,
              );
              return text;
            }
            return undefined;
          },
          "searched",
        );
      },
    });
  }
}
