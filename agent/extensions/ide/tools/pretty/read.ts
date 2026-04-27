import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { fileIconGlyph } from "../icons";
import { humanSize } from "../images";
import { renderFileContent } from "../renderers";
import { termW, shortPath } from "../terminal-utils";
import {
  extractTextContent,
  renderError,
  getTextComponent,
  type ToolExecuteFn,
  type WrappedToolHandler,
} from "./utils";
import type { ToolRenderContext } from "./types";

interface ReadParams {
  path: string;
  offset?: number;
  limit?: number;
}

// pi framework requires 5-arg handler signature
 
export function createReadExecute(
  orig: ToolExecuteFn,
): WrappedToolHandler<ReadParams> {
  const handler = async (
    tid: string,
    params: ReadParams,
    sig: AbortSignal | undefined,
    upd: ((details: Record<string, unknown>) => void) | undefined,
    ctx: unknown,
  ): Promise<unknown> => {
    const result = (await orig(tid, params, sig, upd, ctx)) as {
      content: (TextContent | ImageContent)[];
      details?: Record<string, unknown>;
    };

    const fp = params.path ?? "";
    const imageBlock = findImageBlock(result.content);
    if (imageBlock) {
      result.details = buildImageDetails(fp, imageBlock);
      return result;
    }

    enrichTextResult(result, fp, params.offset);
    return result;
  };

  return handler as WrappedToolHandler<ReadParams>;
}
 

function findImageBlock(
  content: (TextContent | ImageContent)[] | undefined,
): ImageContent | undefined {
  return content?.find((c): c is ImageContent => c.type === "image");
}

function enrichTextResult(
  result: {
    content: (TextContent | ImageContent)[];
    details?: Record<string, unknown>;
  },
  filePath: string,
  offset: number | undefined,
): void {
  const textContent = extractTextContent(result.content);
  if (!textContent || !filePath) return;
  result.details = buildFileReadDetails(filePath, textContent, offset ?? 1);
}

function buildImageDetails(
  filePath: string,
  imageBlock: ImageContent,
): Record<string, unknown> {
  return {
    _type: "readImage" as const,
    filePath,
    data: imageBlock.data,
    mimeType: imageBlock.mimeType ?? "image/png",
  };
}

function buildFileReadDetails(
  filePath: string,
  content: string,
  offset: number,
): Record<string, unknown> {
  return {
    _type: "readFile" as const,
    filePath,
    content,
    offset,
    lineCount: content.split("\n").length,
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
    const fp = args.path;
    const text = getTextComponent(ctx, Text);
    const offsetStr = args.offset
      ? ` ${theme.fg("muted", `from line ${args.offset}`)}`
      : "";
    const limitStr = args.limit
      ? ` ${theme.fg("muted", `(${args.limit} lines)`)}`
      : "";
    text.setText(
      `${theme.fg("toolTitle", theme.bold("read"))} ${theme.fg("accent", sp(fp))}${offsetStr}${limitStr}`,
    );
    return text;
  };
}

function renderImageResult(
  details: Record<string, unknown>,
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): void {
  const tw = termW();
  const byteSize = Math.ceil(((details.data as string).length * 3) / 4);
  const sizeStr = humanSize(byteSize);
  const mimeStr = (details.mimeType as string) ?? "image";
  text.setText(
    `  ${fileIconGlyph(details.filePath as string)}${theme.fg("dim", `${mimeStr} · ${sizeStr}`)}\n${theme.fg("border", "─".repeat(tw))}\n${theme.fg("border", "─".repeat(tw))}`,
  );
}

function renderFileResult(
  details: Record<string, unknown>,
  options: { expanded: boolean },
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): void {
  const maxShow = options.expanded ? (details.lineCount as number) : 80;
  void renderFileContent({
    content: details.content as string,
    filePath: details.filePath as string,
    offset: details.offset as number,
    maxLines: maxShow,
    theme,
  }).then((rendered) => {
    text.setText(rendered);
  });
}

function renderFallbackResult(
  result: { content: (TextContent | ImageContent)[] },
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): void {
  const fallback = result.content?.[0] as { text?: string } | undefined;
  text.setText(
    `  ${theme.fg("dim", (fallback?.text ?? "read").slice(0, 120))}`,
  );
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
    const rendered = tryRenderDetailResult(d, options, theme, text);
    if (rendered) return rendered;

    renderFallbackResult(result, theme, text);
    return text;
  };
}

function dispatchDetailRenderer(
  details: Record<string, unknown>,
  options: { expanded: boolean },
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): void {
  const d = details as { _type?: string; content?: unknown };
  if (d._type === "readImage") {
    renderImageResult(details, theme, text);
    return;
  }
  if (d._type === "readFile" && !!d.content) {
    renderFileResult(details, options, theme, text);
  }
}

function tryRenderDetailResult(
  details: Record<string, unknown> | undefined,
  options: { expanded: boolean },
  theme: Theme,
  text: Component & { setText: (s: string) => void },
): Component | null {
  if (!details) return null;
  dispatchDetailRenderer(details, options, theme, text);
  return text;
}
