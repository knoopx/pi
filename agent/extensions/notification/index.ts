/**
 * Notify-Send Extension
 *
 * Provides a tool to send desktop notifications using notify-send.
 * Supports urgency levels, expiration time, app name, icon, and category.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { buildNotifySendArgs, normalizeToolExecuteArgs } from "./notify-send";

export default function notificationExtension(pi: ExtensionAPI) {
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

      return {
        content: [{ type: "text", text: "Notification sent successfully" }],
        details: {
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    },
  });
}
