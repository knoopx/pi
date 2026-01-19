import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
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
    parameters: Type.Object({
      source: Type.String({
        description: "URL or file path to transcribe into human-readable text",
      }),
    }),

    async execute(_toolCallId, params, onUpdate, ctx, signal) {
      const { source } = params as { source: string };

      try {
        // Run markitdown on the source (file or URL)
        onUpdate?.({
          content: [
            {
              type: "text",
              text: `Converting ${source} to Markdown...`,
            },
          ],
          details: { source, status: "converting" },
        });

        const result = await pi.exec("markitdown", [source], { signal });

        if (result.code === 0) {
          return {
            content: [{ type: "text", text: result.stdout }],
            details: { source, converted: true },
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Error converting source: ${
                  result.stderr || result.stdout
                }`,
              },
            ],
            details: { source, error: result.stderr || result.stdout },
          };
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Unexpected error: ${error}` }],
          details: { source, error: String(error) },
        };
      }
    },
  });
}
