/**
 * Niri Extension
 *
 * Controls the niri Wayland compositor via its IPC.
 * Each tool maps 1:1 to a niri msg command.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { buildScreenshotScreenArgs, buildScreenshotWindowArgs } from "./args";
import {
  formatWindows,
  formatWorkspaces,
  formatOutputs,
  formatFocusedWindow,
  formatFocusedOutput,
  formatPickedWindow,
  formatPickedColor,
  formatScreenshotDone,
  type NiriWindow,
  type NiriWorkspace,
  type NiriOutput,
} from "./format";

async function niriMsg(
  pi: ExtensionAPI,
  args: string[],
  signal?: AbortSignal,
): Promise<{ ok: boolean; output: string; code: number }> {
  const result = await pi.exec(
    "niri",
    ["msg", ...args],
    signal ? { signal } : undefined,
  );
  const output = result.stdout || result.stderr || "";
  return { ok: result.code === 0, output, code: result.code };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
    details: {},
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function jsonQueryTool(
  pi: ExtensionAPI,
  name: string,
  label: string,
  description: string,
  niriCommand: string,
  formatter: (data: unknown) => string,
) {
  pi.registerTool({
    name,
    label,
    description,
    parameters: Type.Object({}),

    async execute(_toolCallId, _params, signal) {
      const result = await niriMsg(pi, ["-j", niriCommand], signal);
      if (!result.ok) {
        return errorResult(`${niriCommand} failed: ${result.output}`);
      }
      const data = parseJson(result.output);
      const text = data !== null ? formatter(data) : result.output;
      return { content: [{ type: "text", text }], details: {} };
    },

    renderCall(_args, theme) {
      return new Text(theme.fg("toolTitle", name), 0, 0);
    },
  });
}

export default function niriExtension(pi: ExtensionAPI) {
  // ── Query tools (niri msg <command>) ───────────────────

  jsonQueryTool(
    pi,
    "niri-windows",
    "Niri Windows",
    "List open windows with id, title, app_id, workspace, and floating/focused state.",
    "windows",
    (data) => formatWindows(data as NiriWindow[]),
  );

  jsonQueryTool(
    pi,
    "niri-focused-window",
    "Niri Focused Window",
    "Print information about the focused window.",
    "focused-window",
    (data) => formatFocusedWindow(data as NiriWindow | null),
  );

  jsonQueryTool(
    pi,
    "niri-focused-output",
    "Niri Focused Output",
    "Print information about the focused output.",
    "focused-output",
    (data) => formatFocusedOutput(data as NiriOutput | null),
  );

  jsonQueryTool(
    pi,
    "niri-outputs",
    "Niri Outputs",
    "List connected outputs with name, resolution, scale, and VRR state.",
    "outputs",
    (data) => formatOutputs(data as NiriOutput[]),
  );

  jsonQueryTool(
    pi,
    "niri-workspaces",
    "Niri Workspaces",
    "List workspaces with index, name, output, and active/focused state.",
    "workspaces",
    (data) => formatWorkspaces(data as NiriWorkspace[]),
  );

  // ── Interactive pickers (niri msg <command>) ───────────

  jsonQueryTool(
    pi,
    "niri-pick-window",
    "Niri Pick Window",
    "Pick a window with the mouse and return its information. Interactive — waits for a mouse click.",
    "pick-window",
    (data) => formatPickedWindow(data as NiriWindow | null),
  );

  jsonQueryTool(
    pi,
    "niri-pick-color",
    "Niri Pick Color",
    "Pick a color from the screen with the mouse. Interactive — waits for a mouse click.",
    "pick-color",
    (data) => formatPickedColor(data as string | null),
  );

  // ── Screenshot tools (niri msg action <command>) ───────

  pi.registerTool({
    name: "niri-screenshot-screen",
    label: "Niri Screenshot Screen",
    description: "Screenshot the focused screen.",
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({
          description:
            "Absolute path to save the screenshot. If omitted, uses the screenshot-path config setting.",
        }),
      ),
      showPointer: Type.Optional(
        Type.Boolean({
          description:
            "Include the mouse pointer in the screenshot (default: true)",
        }),
      ),
      writeToDisk: Type.Optional(
        Type.Boolean({
          description: "Write to disk in addition to clipboard (default: true)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      const result = await niriMsg(
        pi,
        buildScreenshotScreenArgs(params),
        signal,
      );
      if (!result.ok) {
        return errorResult(`screenshot-screen failed: ${result.output}`);
      }
      return {
        content: [{ type: "text", text: formatScreenshotDone(params.path) }],
        details: {},
      };
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("niri-screenshot-screen")) +
          (args.path ? theme.fg("muted", ` ${args.path}`) : ""),
        0,
        0,
      );
    },
  });

  pi.registerTool({
    name: "niri-screenshot-window",
    label: "Niri Screenshot Window",
    description:
      "Screenshot a window. Uses the focused window if no id is specified.",
    parameters: Type.Object({
      id: Type.Optional(
        Type.Number({
          description:
            "Window id to screenshot (from niri-windows). If omitted, uses the focused window.",
        }),
      ),
      path: Type.Optional(
        Type.String({
          description:
            "Absolute path to save the screenshot. If omitted, uses the screenshot-path config setting.",
        }),
      ),
      writeToDisk: Type.Optional(
        Type.Boolean({
          description: "Write to disk in addition to clipboard (default: true)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      const result = await niriMsg(
        pi,
        buildScreenshotWindowArgs(params),
        signal,
      );
      if (!result.ok) {
        return errorResult(`screenshot-window failed: ${result.output}`);
      }
      return {
        content: [{ type: "text", text: formatScreenshotDone(params.path) }],
        details: {},
      };
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("niri-screenshot-window"));
      if (args.id !== undefined) text += theme.fg("muted", ` id=${args.id}`);
      if (args.path) text += theme.fg("muted", ` ${args.path}`);
      return new Text(text, 0, 0);
    },
  });
}
