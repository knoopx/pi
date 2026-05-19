import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const SETTINGS_PATH = resolve(homedir(), ".pi/agent/settings.json");

async function loadSettings(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function saveTtsEnabled(enabled: boolean): Promise<void> {
  const settings = await loadSettings();
  settings.notification = { tts: enabled };
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(
    SETTINGS_PATH,
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf-8",
  );
}

async function loadTtsEnabled(): Promise<boolean> {
  const settings = await loadSettings();
  const notification = settings.notification as { tts?: boolean } | undefined;
  return notification?.tts ?? false;
}

interface NotifyToolParams {
  message: string;
}

function buildErrorResult(
  errorMessage: string,
  result: { code: number; stdout: string; stderr: string },
): AgentToolResult<{
  exitCode: number;
  output: string;
}> {
  return {
    content: [
      {
        type: "text" as const,
        text: `Failed to send notification: ${errorMessage}`,
      },
    ],
    details: {
      exitCode: result.code,
      output: result.stdout || result.stderr,
    },
  };
}

function runTts(pi: ExtensionAPI, text: string): void {
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
    const result = await pi.exec("notify-send", [params.message], options);

    if (result.code !== 0) {
      const message =
        result.stderr ||
        result.stdout ||
        "notify-send failed. Is notify-send installed and available in PATH?";
      return buildErrorResult(message, result);
    }

    if (isTtsEnabledRef.value) {
      runTts(pi, params.message);
    }

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
    label: "Inform User",
    description:
      "Inform the user what is happening. Mandatory on every phase change and task completion. Never skip — always tell the user what you are doing and when you are done.",
    parameters: Type.Object({
      message: Type.String({
        description: "The notification message",
      }),
    }),

    execute: createExecuteNotify(isTtsEnabledRef, pi),
  };
}

const ttsDescription =
  "Toggle text-to-speech for notifications (usage: /tts [on|off])";

function createTtsHandler(isTtsEnabledRef: { value: boolean }) {
  return async function handler(
    _args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = _args.toLowerCase().trim();
    let message: string;

    switch (action) {
      case "on":
        isTtsEnabledRef.value = true;
        await saveTtsEnabled(true);
        message = "TTS enabled for notifications";
        break;
      case "off":
        isTtsEnabledRef.value = false;
        await saveTtsEnabled(false);
        message = "TTS disabled for notifications";
        break;
      default:
        if (action === "") {
          isTtsEnabledRef.value = !isTtsEnabledRef.value;
          await saveTtsEnabled(isTtsEnabledRef.value);
          message = isTtsEnabledRef.value
            ? "TTS enabled for notifications"
            : "TTS disabled for notifications";
        } else {
          message = `TTS is ${isTtsEnabledRef.value ? "on" : "off"}. Use /tts [on|off].`;
        }
    }

    if (ctx.hasUI) ctx.ui?.notify(message, "info");
  };
}

export default async function notifyExtension(pi: ExtensionAPI): Promise<void> {
  const isTtsEnabledRef = { value: false };
  isTtsEnabledRef.value = await loadTtsEnabled();

  pi.registerTool(makeNotifyTool(isTtsEnabledRef, pi));

  pi.registerCommand("tts", {
    description: ttsDescription,
    handler: createTtsHandler(isTtsEnabledRef),
  });
}
