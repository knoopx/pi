import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { encode } from "@toon-format/toon";

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event) => {
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
