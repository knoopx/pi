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
    if (isTtsEnabledRef.value) {
      return sendTtsNotification(pi, params.message);
    }
    return sendNotifySend(pi, params.message, signal);
  };
}

function sendTtsNotification(
  pi: ExtensionAPI,
  message: string,
): AgentToolResult<Record<string, unknown>> {
  runTts(pi, message);
  return {
    content: [{ type: "text" as const, text: "Notification sent via TTS" }],
    details: {},
  };
}

async function sendNotifySend(
  pi: ExtensionAPI,
  message: string,
  signal: AbortSignal | undefined,
): Promise<AgentToolResult<Record<string, unknown>>> {
  const result = await pi.exec("notify-send", [message], {
    signal: signal ?? undefined,
  });

  if (result.code !== 0) {
    return buildErrorResult(
      result.stderr ||
        "notify-send failed. Is notify-send installed and available in PATH?",
      result,
    );
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
}

function makeNotifyTool(isTtsEnabledRef: { value: boolean }, pi: ExtensionAPI) {
  return {
    name: "notify",
    label: "Inform User",
    description:
      "Inform the user what is happening. Notify on phase changes, mutations, and task completion. Keep messages high-level.",
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

async function handleTtsToggle(isTtsEnabledRef: {
  value: boolean;
}): Promise<string> {
  isTtsEnabledRef.value = !isTtsEnabledRef.value;
  await saveTtsEnabled(isTtsEnabledRef.value);
  return isTtsEnabledRef.value
    ? "TTS enabled for notifications"
    : "TTS disabled for notifications";
}

function handleTtsSet(
  isTtsEnabledRef: { value: boolean },
  enabled: boolean,
): Promise<string> {
  isTtsEnabledRef.value = enabled;
  return saveTtsEnabled(enabled).then(() =>
    enabled
      ? "TTS enabled for notifications"
      : "TTS disabled for notifications",
  );
}

function createTtsHandler(isTtsEnabledRef: { value: boolean }) {
  return async function handler(
    _args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = _args.toLowerCase().trim();
    const message = await resolveTtsMessage(action, isTtsEnabledRef);

    if (ctx.hasUI) ctx.ui?.notify(message, "info");
  };
}

async function resolveTtsMessage(
  action: string,
  ref: { value: boolean },
): Promise<string> {
  if (action === "") return handleTtsToggle(ref);
  if (action === "on" || action === "off") {
    return handleTtsSet(ref, action === "on");
  }
  return `TTS is ${ref.value ? "on" : "off"}. Use /tts [on|off].`;
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
