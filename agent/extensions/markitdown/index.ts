import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

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
    parameters: Type.Object({
      source: Type.String({
        description: "URL or file path to transcribe into human-readable text",
      }),
    }),

    async execute(_toolCallId, params, signal, onUpdate) {
      const { source } = params;

      try {
        onUpdate?.({
          content: [
            {
              type: "text",
              text: `Converting ${source} to Markdown...`,
            },
          ],
          details: { source, status: "converting" },
        });

        // Only pass signal if it's a valid AbortSignal with addEventListener
        const hasValidSignal =
          signal instanceof AbortSignal &&
          typeof signal.addEventListener === "function";

        // Detect if source is a URL (remote) and fetch with proper User-Agent
        const isRemote = /^https?:\/\//i.test(source);
        let result;

        const markitdownPath = `${process.env.HOME}/.local/bin/markitdown`;

        if (isRemote) {
          // Use curl to fetch and pipe directly to markitdown to avoid E2BIG
          const command = `curl -s -A 'Mozilla/5.0' -o - '${source}' | ${markitdownPath}`;
          result = await pi.exec(
            "bash",
            ["-c", command],
            hasValidSignal ? { signal } : undefined,
          );
        } else {
          // Local file - use markitdown directly
          result = await pi.exec(
            markitdownPath,
            [source],
            hasValidSignal ? { signal } : undefined,
          );
        }

        if (result.code === 0)
          return {
            content: [{ type: "text", text: result.stdout }],
            details: { source, converted: true },
          };
        // Build error message with all available information
        const stderr = result.stderr?.trim();
        const stdout = result.stdout?.trim();
        const errorMessage = [stderr, stdout, `Exit code: ${result.code}`]
          .filter(Boolean)
          .join("\n\n");

        const errorText =
          errorMessage || `markitdown failed with exit code ${result.code}`;

        return {
          content: [
            {
              type: "text",
              text: `Error converting source: ${errorText}`,
            },
          ],
          details: { source, error: errorMessage, exitCode: result.code },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Unexpected error: ${error}` }],
          details: { source, error: String(error) },
        };
      }
    },
  });
}
