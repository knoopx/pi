/**
 * Notify-Send Extension
 *
 * Provides a tool to send desktop notifications using notify-send.
 * Supports urgency levels, expiration time, app name, icon, and category.
 */

import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { buildNotifySendArgs } from "./notify-send";

interface NotifyToolParams {
  summary: string;
  body?: string;
  urgency?: "low" | "normal" | "critical";
  expireTime?: number;
  appName?: string;
  icon?: string;
  category?: string;
}

const buildSpeechText = (summary: string, body?: string): string =>
  body ? `${summary}. ${body}` : summary;

const runTts = (pi: ExtensionAPI, text: string): void => {
  if (!text.trim()) return;

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

function buildErrorResult(
  message: string,
  result: { code: number; stdout: string; stderr: string },
): AgentToolResult<{
  exitCode: number;
  output: string;
}> {
  return {
    content: [
      {
        type: "text" as const,
        text: `Failed to send notification: ${message}`,
      },
    ],
    details: {
      exitCode: result.code,
      output: result.stdout || result.stderr,
    },
  };
}

function runTtsIfNeeded(
  isTtsEnabled: boolean,
  pi: ExtensionAPI,
  params: { summary: string; body?: string },
): void {
  if (!isTtsEnabled) return;
  runTts(pi, buildSpeechText(params.summary, params.body));
}

function createExecuteNotify(
  isTtsEnabledRef: { value: boolean },
  pi: ExtensionAPI,
) {
  return async function executeNotify(
    _toolCallId: string,
    params: NotifyToolParams,
    signal: AbortSignal | undefined,
  ): Promise<AgentToolResult<Record<string, unknown>>> {
    const options = signal ? { signal } : undefined;

    const args = buildNotifySendArgs(params);
    const result = await pi.exec("notify-send", args, options);

    if (result.code !== 0) {
      const message =
        result.stderr ||
        result.stdout ||
        "notify-send failed. Is notify-send installed and available in PATH?";
      return buildErrorResult(message, result);
    }

    runTtsIfNeeded(isTtsEnabledRef.value, pi, params);

    return {
      content: [
        { type: "text" as const, text: "Notification sent successfully" },
      ],
      details: {
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      } as Record<string, unknown>,
    };
  };
}

function makeNotifyTool(isTtsEnabledRef: { value: boolean }, pi: ExtensionAPI) {
  return {
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

    execute: createExecuteNotify(isTtsEnabledRef, pi),
  };
}

const ttsDescription =
  "Toggle text-to-speech for notifications (usage: /tts [on|off|toggle])";

function createTtsHandler(isTtsEnabledRef: { value: boolean }) {
  return async function handler(
    _args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = _args.toLowerCase().trim() || "toggle";
    let message: string;

    switch (action) {
      case "on":
        isTtsEnabledRef.value = true;
        message = "TTS enabled for notifications";
        break;
      case "off":
        isTtsEnabledRef.value = false;
        message = "TTS disabled for notifications";
        break;
      case "toggle":
        isTtsEnabledRef.value = !isTtsEnabledRef.value;
        message = isTtsEnabledRef.value
          ? "TTS enabled for notifications"
          : "TTS disabled for notifications";
        break;
      default:
        message = `TTS is ${isTtsEnabledRef.value ? "on" : "off"}. Use /tts [on|off|toggle].`;
    }

    if (ctx.hasUI) ctx.ui?.notify(message, "info");
  };
}

export default function notificationExtension(pi: ExtensionAPI): void {
  const isTtsEnabledRef = { value: false };

  pi.registerTool(makeNotifyTool(isTtsEnabledRef, pi));

  pi.registerCommand("tts", {
    description: ttsDescription,
    handler: createTtsHandler(isTtsEnabledRef),
  });
}
