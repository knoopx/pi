import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { fileIconGlyph } from "../icons";
import { humanSize } from "../images";
import { renderFileContent, renderTree } from "../renderers";
import { termW, shortPath } from "../utils";
import { extractTextContent, renderError, getTextComponent } from "./utils";
import type { ToolRenderContext } from "./types";

interface ReadParams {
  path: string;
  offset?: number;
  limit?: number;
}

export function createReadExecute(
  orig: (
    tid: string,
    params: unknown,
    sig: unknown,
    upd: unknown,
    ctx: unknown,
  ) => Promise<unknown>,
): (
  tid: string,
  params: ReadParams,
  sig: AbortSignal | undefined,
  upd: ((details: Record<string, unknown>) => void) | undefined,
  ctx: any,
) => Promise<unknown> {
  return async (tid, params, sig, upd, ctx) => {
    const p = params as ReadParams;
    const result = (await orig(tid, p, sig, upd, ctx)) as {
      content: (TextContent | ImageContent)[];
      details?: Record<string, unknown>;
    };

    const fp = p.path ?? "";
    const offset = p.offset ?? 1;
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
  };
}

export function createReadRenderCall(
  cwd: string,
  home: string,
): (
  args: ReadParams,
  theme: Theme,
  ctx: ToolRenderContext<unknown, ReadParams>,
) => Component {
  const sp = (p: string) => shortPath(cwd, home, p);
  return (args, theme, ctx) => {
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
  };
}

export function createReadRenderResult(): (
  result: {
    content: (TextContent | ImageContent)[];
    details?: Record<string, unknown>;
  },
  options: { expanded: boolean },
  theme: Theme,
  ctx: ToolRenderContext<unknown, ReadParams>,
) => Component {
  return (result, options, theme, ctx) => {
    const text = getTextComponent(ctx, Text);
    if (ctx.isError) return renderError(result.content, theme, text);
    const d = result.details;
    if (d?._type === "readImage") {
      const tw = termW();
      const byteSize = Math.ceil(((d.data as string).length * 3) / 4);
      const sizeStr = humanSize(byteSize);
      const mimeStr = (d.mimeType as string) ?? "image";
      text.setText(
        `  ${fileIconGlyph(d.filePath as string)}${theme.fg("dim", `${mimeStr} · ${sizeStr}`)}\n${theme.fg("border", "─".repeat(tw))}\n${theme.fg("border", "─".repeat(tw))}`,
      );
      return text;
    }
    if (d?._type === "readFile" && d.content) {
      const maxShow = options.expanded ? (d.lineCount as number) : 80;
      renderFileContent(
        d.content as string,
        d.filePath as string,
        d.offset as number,
        maxShow,
        theme,
      ).then((rendered) => {
        text.setText(rendered);
      });
      return text;
    }
    const fallback = result.content?.[0] as { text?: string } | undefined;
    text.setText(
      `  ${theme.fg("dim", (fallback?.text ?? "read").slice(0, 120))}`,
    );
    return text;
  };
}
