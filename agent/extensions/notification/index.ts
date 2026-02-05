/**
 * Notify-Send Extension
 *
 * Provides a tool to send desktop notifications using notify-send.
 * Supports urgency levels, expiration time, app name, icon, and category.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { buildNotifySendArgs, normalizeToolExecuteArgs } from "./notify-send";

const buildSpeechText = (summary: string, body?: string) =>
  body ? `${summary}. ${body}` : summary;

const runTts = (pi: ExtensionAPI, text: string) => {
  if (!text.trim()) {
    return;
  }

  const escaped = text.replace(/'/g, "'\\''");
  void pi.exec("sh", [
    "-c",
    `pkill -f '^tts ' 2>/dev/null; sh -c '
playing=$(playerctl --all-players -f "{{playerName}} {{status}}" status 2>/dev/null | grep Playing | cut -d" " -f1)
playerctl --all-players pause 2>/dev/null
tts '"'"'${escaped}'"'"' &>/dev/null
for player in $playing; do playerctl -p "$player" play 2>/dev/null; done
' &`,
  ]);
};

export default function notificationExtension(pi: ExtensionAPI) {
  let isTtsEnabled = false;

  pi.registerTool({
    name: "notify",
    label: "Send Notification",
    description:
      "Send a desktop notification using notify-send. Supports urgency, expiration, app name, icon, and category.",
    parameters: Type.Object({
      summary: Type.String({ description: "Notification summary/title" }),
      body: Type.Optional(
        Type.String({ description: "Notification body text" }),
      ),
      urgency: Type.Optional(
        StringEnum(["low", "normal", "critical"] as const, {
          description: "Urgency level (default: normal)",
        }),
      ),
      expireTime: Type.Optional(
        Type.Number({
          description:
            "Expiration time in milliseconds (default: system default)",
        }),
      ),
      appName: Type.Optional(
        Type.String({ description: "Application name to display" }),
      ),
      icon: Type.Optional(
        Type.String({ description: "Icon filename or stock icon name" }),
      ),
      category: Type.Optional(
        Type.String({ description: "Notification category" }),
      ),
    }),

    async execute(_toolCallId, params, onUpdate, ctx, signal) {
      const normalized = normalizeToolExecuteArgs(onUpdate, ctx, signal);
      const options = normalized.signal
        ? { signal: normalized.signal }
        : undefined;

      const args = buildNotifySendArgs(params);
      const result = await pi.exec("notify-send", args, options);

      if (result.code !== 0) {
        const message =
          result.stderr ||
          result.stdout ||
          "notify-send failed. Is notify-send installed and available in PATH?";

        return {
          content: [
            {
              type: "text",
              text: `Failed to send notification: ${message}`,
            },
          ],
          isError: true,
          details: {
            exitCode: result.code,
            stdout: result.stdout,
            stderr: result.stderr,
          },
        };
      }

      if (isTtsEnabled) {
        runTts(pi, buildSpeechText(params.summary, params.body));
      }

      return {
        content: [{ type: "text", text: "Notification sent successfully" }],
        details: {
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    },

    renderCall(args, theme) {
      const summary = args.summary
        ? args.summary.length > 50
          ? `"${args.summary.substring(0, 50)}..."`
          : `"${args.summary}"`
        : "";
      return new Text(
        theme.fg("toolTitle", theme.bold("notify")) +
          (summary ? theme.fg("muted", ` ${summary}`) : ""),
        0,
        0,
      );
    },

    renderResult(result, _options, theme) {
      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      return new Text(theme.fg("success", text), 0, 0);
    },
  });

  pi.registerCommand("tts", {
    description:
      "Toggle text-to-speech for notifications (usage: /tts [on|off|toggle])",
    handler: async (args, ctx) => {
      const action = args.toLowerCase().trim() || "toggle";
      let message = "";

      if (action === "on") {
        isTtsEnabled = true;
        message = "TTS enabled for notifications";
      } else if (action === "off") {
        isTtsEnabled = false;
        message = "TTS disabled for notifications";
      } else if (action === "toggle") {
        isTtsEnabled = !isTtsEnabled;
        message = isTtsEnabled
          ? "TTS enabled for notifications"
          : "TTS disabled for notifications";
      } else {
        message = `TTS is ${isTtsEnabled ? "on" : "off"}. Use /tts [on|off|toggle].`;
      }

      if (ctx.hasUI) {
        ctx.ui.notify(message, "info");
      }
    },
  });
}
