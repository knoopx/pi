import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";
import { parse } from "./lib/registry";
import { getCached, setCached } from "./lib/cache";

const WebfetchParams = Type.Object({
  source: Type.String({
    description: "URL or file path to fetch and convert to human-readable text",
  }),
});

type WebfetchParamsType = Static<typeof WebfetchParams>;

export default function (pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web-fetch",
    label: "Web Fetch",
    description: `Fetch web content and convert files to Markdown text.

Use this to:
- Fetch web pages and convert to Markdown
- Convert documents to readable text
- Extract content from PDFs and Office files
- Process various file formats

Supports URLs and local files.`,
    parameters: WebfetchParams,

    async execute(_toolCallId, params, _signal) {
      const { source } = params as WebfetchParamsType;

      const cached = await getCached(source);
      if (cached !== null) {
        return {
          content: [{ type: "text", text: cached }],
          details: { source, cached: true },
        };
      }

      const result = await parse(source);

      let text: string;
      if (typeof result === "string") {
        text = result;
      } else {
        text = toMarkdown(result, {
          extensions: [gfmToMarkdown()],
        });
      }

      await setCached(source, text);

      return {
        content: [{ type: "text", text }],
        details: { source, cached: false },
      };
    },
  });
}
