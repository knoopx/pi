import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "command-examples",
    label: "Command Examples",
    description: `Get command-line examples and reference sheets from cheat.sh.

Use this to:
- Find usage examples for CLI commands
- Get programming language syntax help
- Access quick reference guides
- Learn tool usage patterns

Provides examples for commands, languages, and tools.`,
    parameters: Type.Object({
      query: Type.String({
        description:
          "Command, language, or topic to get cheatsheet for (e.g., 'ls', 'python/loops', 'git')",
      }),
      section: Type.Optional(
        Type.String({
          description:
            "Specific section to get (e.g., 'examples', 'description')",
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { query, section } = params as { query: string; section?: string };

      // Build the URL
      let url = `https://cheat.sh/${encodeURIComponent(query)}`;
      if (section) {
        url += `/${encodeURIComponent(section)}`;
      }
      url += `?T`;

      try {
        // Check for cancellation
        if (_signal?.aborted) {
          return {
            content: [{ type: "text", text: "Cancelled" }],
            details: { query, url, section },
          };
        }

        _onUpdate?.({
          content: [
            { type: "text", text: `Fetching cheatsheet for ${query}...` },
          ],
          details: { query, url, section, status: "fetching" },
        });

        // Fetch from cheat.sh
        const response = await fetch(url, {
          signal: _signal || AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          if (response.status === 404) {
            return {
              content: [
                {
                  type: "text",
                  text: `No cheatsheet found for "${query}". Try a different query or check https://cheat.sh/${query} directly.`,
                },
              ],
              details: { query, url, status: response.status },
            };
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const cheatsheet = await response.text();

        // Check if the response contains HTML (indicating an error page)
        if (
          cheatsheet.trim().toLowerCase().startsWith("<!doctype html") ||
          cheatsheet.trim().toLowerCase().startsWith("<html")
        ) {
          return {
            content: [
              {
                type: "text",
                text: `No cheatsheet found for "${query}". Try a different query or check ${url} directly.`,
              },
            ],
            details: {
              query,
              url,
              section,
              status: response.status,
              isHtml: true,
            },
          };
        }

        // Check for "Unknown topic" responses
        if (cheatsheet.trim().toLowerCase().startsWith("unknown topic")) {
          return {
            content: [
              {
                type: "text",
                text: `No cheatsheet found for "${query}". Try a different query or check ${url} directly.`,
              },
            ],
            details: {
              query,
              url,
              section,
              status: response.status,
              unknownTopic: true,
            },
          };
        }
        const decodedCheatsheet = cheatsheet
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&nbsp;/g, " ")
          .replace(/&hellip;/g, "…")
          .replace(/&mdash;/g, "—")
          .replace(/&ndash;/g, "–")
          .replace(/&lsquo;/g, "'")
          .replace(/&rsquo;/g, "'")
          .replace(/&ldquo;/g, '"')
          .replace(/&rdquo;/g, '"');

        // No need to strip ANSI codes: ?T returns plain text

        // Truncate if too long (following best practices)
        const MAX_CONTENT_LENGTH = 10000; // Reasonable limit for LLM context
        let content = decodedCheatsheet.trim();
        let truncated = false;

        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.substring(0, MAX_CONTENT_LENGTH);
          truncated = true;
        }

        let result = content;

        if (truncated) {
          result += `\n\n[Content truncated at ${MAX_CONTENT_LENGTH} characters. Full cheatsheet available at: ${url}]`;
        }

        return {
          content: [{ type: "text", text: result }],
          details: {
            query,
            url,
            section,
            truncated,
            contentLength: cheatsheet.length,
          },
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return {
            content: [{ type: "text", text: "Request cancelled" }],
            details: { query, url, section },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch cheatsheet: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          details: {
            query,
            url,
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });
}
