import type {
  ExtensionAPI,
  AgentToolResult,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { parse } from "./lib/registry";

const Params = Type.Object({
  source: Type.String({
    description: "URL or file path to transcribe into human-readable text",
  }),
});
type ParamsType = Static<typeof Params>;

function buildSuccessResult(
  source: string,
  markdown: string,
): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: "text" as const, text: markdown }],
    details: { source, converted: true },
  };
}

function buildErrorResult(
  source: string,
  error: unknown,
): AgentToolResult<{ source: string }> {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Conversion failed: ${message}` }],
    details: { source },
  };
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool({
    name: "transcribe",
    label: "Transcribe",
    description: `Convert various file formats and web content to Markdown text.

Use this to:
- Convert documents to readable text
- Extract content from PDFs and Office files
- Transcribe web pages to Markdown
- Process various file formats

Supports URLs and local files.`,
    parameters: Params,
    async execute(
      _toolCallId: string,
      params: ParamsType,
      signal: AbortSignal | undefined,
      onUpdate?,
    ): Promise<AgentToolResult<{ source: string }>> {
      const { source } = params;

      try {
        onUpdate?.({
          content: [
            {
              type: "text" as const,
              text: `Converting ${source} to Markdown...`,
            },
          ],
          details: { source },
        });

        const result = await parse(source, signal);
        let markdown: string;
        if (typeof result === "string") {
          markdown = result.trim();
        } else {
          markdown = toMarkdown(result, {
            extensions: [gfmToMarkdown()],
          }).trim();
        }
        return buildSuccessResult(source, markdown) as AgentToolResult<{
          source: string;
        }>;
      } catch (error) {
        return buildErrorResult(source, error);
      }
    },
  });
}
