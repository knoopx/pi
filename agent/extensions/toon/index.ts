import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { encode } from "@toon-format/toon";

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event) => {
    // Skip encoding for package.json files if the tool provides a path
    const path =
      (event.details as { path?: string; filePath?: string } | undefined)
        ?.path ??
      (event.details as { path?: string; filePath?: string } | undefined)
        ?.filePath;

    if (path && /(^|\/)package\.json$/i.test(path)) {
      return;
    }

    if (event.content.length === 1 && event.content[0].type === "text") {
      const text = event.content[0].text.trim();
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) {
          const toon = encode(parsed);
          return {
            content: [
              {
                type: "text",
                text: toon,
              },
            ],
            details: event.details,
            isError: event.isError,
          };
        }
      } catch {}
    }
  });
}
