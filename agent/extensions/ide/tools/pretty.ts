import {
  createReadToolDefinition as createReadToolDef,
  createBashToolDefinition as createBashToolDef,
  createLsToolDefinition as createLsToolDef,
  createFindToolDefinition as createFindToolDef,
  createGrepToolDefinition as createGrepToolDef,
  createReadTool,
  createBashTool,
  createLsTool,
  createFindTool,
  createGrepTool,
} from "@mariozechner/pi-coding-agent";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  BashToolDetails,
  BashToolInput,
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

// Local type for ToolRenderContext (not exported from SDK)
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
import { basename } from "node:path";

import {
  renderFileContent,
  renderBashOutput,
  renderTree,
  renderFindResults,
  renderGrepResults,
} from "./renderers";
import { fileIconGlyph } from "./icons";
import {
  detectImageProtocol,
  renderIterm2Image,
  renderKittyImage,
  humanSize,
} from "./images";
import { MAX_PREVIEW_LINES } from "./shiki";
import { termW, shortPath } from "./utils";
import {
  extractTextContent,
  renderError,
  renderFallback,
  countLines,
  getTextComponent,
} from "./pretty-utils";

// State tracking for async rendering
interface ReadState {
  _rk?: string;
  _rt?: string;
}

interface GrepState {
  _gk?: string;
  _gt?: string;
}

// Extended details types for the IDE extension
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

type BashDetails =
  | BashToolDetails
  | undefined
  | {
      _type: "bashResult";
      command?: string;
      output?: string;
      exitCode?: number;
      text?: string;
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
  // Resolve to preferred export (new name falls back to old)
  const createReadToolFn = createReadToolDef ?? createReadTool;
  const createBashToolFn = createBashToolDef ?? createBashTool;
  const createLsToolFn = createLsToolDef ?? createLsTool;
  const createFindToolFn = createFindToolDef ?? createFindTool;
  const createGrepToolFn = createGrepToolDef ?? createGrepTool;

  if (!createReadToolFn) return;

  const cwd = process.cwd();
  const home = process.env.HOME ?? "";
  const sp = (p: string) => shortPath(cwd, home, p);

  // ===================================================================
  // read — syntax-highlighted file content
  // ===================================================================

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
        theme.fg("toolTitle", theme.bold("read")) +
          " " +
          theme.fg("accent", sp(fp)) +
          offset +
          limit,
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

      if (ctx.isError) {
        return renderError(result.content, theme, text);
      }

      const d = result.details as unknown as Record<string, unknown>;

      if (d?._type === "readImage") {
        const tw = termW();
        const out: string[] = [];
        const fname = basename(d.filePath as string);
        const byteSize = Math.ceil(((d.data as string).length * 3) / 4);
        const sizeStr = humanSize(byteSize);
        const mimeStr = (d.mimeType as string) ?? "image";

        out.push(
          "  " +
            fileIconGlyph(d.filePath as string) +
            theme.fg("dim", mimeStr + " · " + sizeStr),
        );
        out.push(theme.fg("border", "─".repeat(tw)));

        const protocol = detectImageProtocol();
        if (protocol === "kitty") {
          const imgCols = Math.min(tw - 4, 80);
          out.push(renderKittyImage(d.data as string, { cols: imgCols }));
        } else if (protocol === "iterm2") {
          const imgWidth = Math.min(tw - 4, 80);
          out.push(
            renderIterm2Image(d.data as string, {
              width: "" + imgWidth,
              name: fname,
            }),
          );
        } else {
          out.push(
            theme.fg(
              "dim",
              "  (Inline image preview requires Ghostty, iTerm2, WezTerm, or Kitty)",
            ),
          );
        }

        out.push(theme.fg("border", "─".repeat(tw)));
        text.setText(out.join("\n"));
        return text;
      }

      if (d?._type === "readFile" && d.content) {
        const key =
          "read:" +
          d.filePath +
          ":" +
          d.offset +
          ":" +
          d.lineCount +
          ":" +
          termW();
        if (ctx.state._rk !== key) {
          ctx.state._rk = key;
          const info = theme.fg("dim", "" + d.lineCount + " lines");
          ctx.state._rt = "  " + info;

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
              ctx.state._rt = "  " + info + "\n" + rendered;
              ctx.invalidate();
            })
            .catch(() => {});
        }
        text.setText(
          ctx.state._rt ?? "  " + theme.fg("dim", "" + d.lineCount + " lines"),
        );
        return text;
      }

      const fallback = result.content?.[0] as { text?: string } | undefined;
      const fallbackText = fallback?.text ?? "read";
      text.setText("  " + theme.fg("dim", fallbackText.slice(0, 120)));
      return text;
    },
  });

  // ===================================================================
  // bash — colored exit status
  // ===================================================================

  if (createBashToolFn) {
    const origBash = createBashToolFn(cwd);

    pi.registerTool({
      ...origBash,
      name: "bash",

      async execute(
        tid: string,
        params: BashToolInput,
        sig: AbortSignal | undefined,
        upd: AgentToolUpdateCallback<BashDetails> | undefined,
        ctx: ExtensionContext,
      ): Promise<AgentToolResult<BashDetails>> {
        const result = (await origBash.execute(
          tid,
          params,
          sig,
          upd,
          ctx,
        )) as AgentToolResult<BashDetails>;

        const textContent = extractTextContent(result.content);

        let exitCode: number | null = 0;
        if (textContent) {
          const exitMatch =
            /(?:exit code|exited with|exit status)[:\s]*(\d+)/i.exec(
              textContent,
            );
          if (exitMatch) exitCode = Number(exitMatch[1]);
          if (
            textContent.includes("command not found") ||
            textContent.includes("No such file")
          ) {
            exitCode = 1;
          }
        }

        result.details = {
          _type: "bashResult" as const,
          text: textContent,
          exitCode,
          command: params.command ?? "",
        };

        return result;
      },

      renderCall(
        args: BashToolInput,
        theme: Theme,
        ctx: ToolRenderContext<unknown, BashToolInput>,
      ): Component {
        const cmd = args?.command ?? "";
        const text = getTextComponent(ctx, Text);
        const timeout = args?.timeout
          ? ` ${theme.fg("muted", `(${args.timeout}s timeout)`)}`
          : "";
        text.setText(
          theme.fg("toolTitle", theme.bold("bash")) +
            " " +
            theme.fg("accent", cmd.length > 80 ? cmd.slice(0, 77) + "…" : cmd) +
            timeout,
        );
        return text;
      },

      renderResult(
        result: AgentToolResult<BashDetails>,
        options: ToolRenderResultOptions,
        theme: Theme,
        ctx: ToolRenderContext<unknown, BashToolInput>,
      ): Component {
        const text = getTextComponent(ctx, Text);

        if (ctx.isError) {
          return renderError(result.content, theme, text);
        }

        const d = result.details as unknown as Record<string, unknown>;
        if (d?._type === "bashResult") {
          const { summary } = renderBashOutput(
            d.text as string,
            d.exitCode as number | null,
            theme,
          );
          const lines = (d.text as string).split("\n");
          const lineCount = lines.length;
          const lineInfo =
            lineCount > 1
              ? "  " + theme.fg("dim", "(" + lineCount + " lines)") + " "
              : "";
          const header = "  " + summary + lineInfo;

          if ((d.text as string).trim()) {
            const maxShow = options.expanded ? lineCount : MAX_PREVIEW_LINES;
            const show = lines.slice(0, maxShow);
            const tw = termW();
            const out: string[] = [header, theme.fg("border", "─".repeat(tw))];
            for (const line of show) {
              out.push("  " + line);
            }
            out.push(theme.fg("border", "─".repeat(tw)));
            if (lineCount > maxShow) {
              out.push(
                theme.fg("dim", "  … " + (lineCount - maxShow) + " more lines"),
              );
            }
            text.setText(out.join("\n"));
          } else {
            text.setText(header);
          }
          return text;
        }

        return renderFallback(result.content, "done", theme, text);
      },
    });
  }

  // ===================================================================
  // ls — tree view with icons
  // ===================================================================

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
          theme.fg("toolTitle", theme.bold("ls")) +
            " " +
            theme.fg("accent", sp(fp)),
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

        if (ctx.isError) {
          return renderError(result.content, theme, text);
        }

        const d = result.details as unknown as Record<string, unknown>;
        if (d?._type === "lsResult" && d.text) {
          const tree = renderTree(d.text as string, theme);
          const info = theme.fg("dim", "" + d.entryCount + " entries");
          text.setText("  " + info + "\n" + tree);
          return text;
        }

        return renderFallback(result.content, "listed", theme, text);
      },
    });
  }

  // ===================================================================
  // find — grouped file list with icons
  // ===================================================================

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
          theme.fg("toolTitle", theme.bold("find")) +
            " " +
            theme.fg("accent", pattern) +
            path,
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

        if (ctx.isError) {
          return renderError(result.content, theme, text);
        }

        const d = result.details as unknown as Record<string, unknown>;
        if (d?._type === "findResult" && d.text) {
          const rendered = renderFindResults(d.text as string, theme);
          const info = theme.fg("dim", "" + d.matchCount + " files");
          text.setText("  " + info + "\n" + rendered);
          return text;
        }

        return renderFallback(result.content, "found", theme, text);
      },
    });
  }

  // ===================================================================
  // grep — highlighted matches with line numbers
  // ===================================================================

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
          theme.fg("toolTitle", theme.bold("grep")) +
            " " +
            theme.fg("accent", pattern) +
            path +
            glob,
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

        if (ctx.isError) {
          return renderError(result.content, theme, text);
        }

        const d = result.details as unknown as Record<string, unknown>;
        if (d?._type === "grepResult" && d.text) {
          const key = "grep:" + d.pattern + ":" + d.matchCount + ":" + termW();
          const state = ctx.state as GrepState;
          if (state._gk !== key) {
            state._gk = key;
            const info = theme.fg("dim", "" + d.matchCount + " matches");
            state._gt = "  " + info;

            renderGrepResults(d.text as string, d.pattern as string, theme)
              .then((rendered: string) => {
                if (state._gk !== key) return;
                state._gt = "  " + info + "\n" + rendered;
                ctx.invalidate();
              })
              .catch(() => {});
          }
          text.setText(
            state._gt ?? "  " + theme.fg("dim", "" + d.matchCount + " matches"),
          );
          return text;
        }

        return renderFallback(result.content, "searched", theme, text);
      },
    });
  }
}
