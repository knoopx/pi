import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "transcribe",
    label: "Transcribe",
    description: "Transcribe a URL or local file into human-readable text.",
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
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Unexpected error: ${error}` }],
          details: { source, error: String(error) },
          isError: true,
        };
      }
    },
  });
}
