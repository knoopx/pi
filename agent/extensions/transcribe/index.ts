import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";
import { parse } from "./lib/registry";

const TranscribeParams = Type.Object({
  source: Type.String({
    description: "URL or file path to transcribe into human-readable text",
  }),
});

type TranscribeParamsType = Static<typeof TranscribeParams>;

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
    parameters: TranscribeParams,

    async execute(_toolCallId, params, _signal) {
      const { source } = params as TranscribeParamsType;
      const result = await parse(source);

      if (typeof result === "string") {
        return {
          content: [{ type: "text", text: result }],
          details: { source },
        };
      }

      const markdown = toMarkdown(result, {
        extensions: [gfmToMarkdown()],
      });

      return {
        content: [{ type: "text", text: markdown }],
        details: { source },
      };
    },
  });
}
