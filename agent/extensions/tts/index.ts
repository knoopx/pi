/**
 * TTS (Text-to-Speech) Extension
 *
 * Provides a tool to convert text to speech using the tts CLI.
 * Supports direct text input: tts 'text'
 * Also supports piped input: echo 'text' | tts
 * Automatically pauses active Linux media players during speech and resumes them afterwards.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";

export default function ttsExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "tts",
    label: "Text to Speech",
    description:
      "Convert text to speech using the tts CLI. Speaks the provided text aloud.",
    parameters: Type.Object({
      text: Type.String({ description: "Text to speak aloud" }),
    }),

    async execute(
      _toolCallId,
      params: { text: string },
      _signal,
      _onUpdate,
      _ctx,
    ) {
      // Kill any previous tts process, then spawn new one in background with media player pause/resume
      const escaped = params.text.replace(/'/g, "'\\''");
      pi.exec("sh", [
        "-c",
        `pkill -f '^tts ' 2>/dev/null; sh -c '
playing=$(playerctl --all-players -f "{{playerName}} {{status}}" status 2>/dev/null | grep Playing | cut -d" " -f1)
playerctl --all-players pause 2>/dev/null
tts '"'"'${escaped}'"'"' &>/dev/null
for player in $playing; do playerctl -p "$player" play 2>/dev/null; done
' &`,
      ]);

      return {
        content: [{ type: "text", text: "Text speech started in background" }],
        details: {
          text: params.text,
        },
      };
    },

    renderCall(args, theme) {
      const text = args.text
        ? args.text.length > 50
          ? `"${args.text.substring(0, 50)}..."`
          : `"${args.text}"`
        : "";
      return new Text(
        theme.fg("toolTitle", theme.bold("tts")) +
          (text ? theme.fg("muted", ` ${text}`) : ""),
        0,
        0,
      );
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { error?: string; text?: string }
        | undefined;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      return new Text(theme.fg("success", text), 0, 0);
    },
  });
}
