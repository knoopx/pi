/**
 * Notify-Send Extension
 *
 * Provides a tool to send desktop notifications using notify-send.
 * Supports urgency levels, expiration time, app name, icon, and category.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

export default function (pi: ExtensionAPI) {
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
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      // Build the command
      let command = "notify-send";

      if (params.urgency) {
        command += ` -u ${params.urgency}`;
      }

      if (params.expireTime !== undefined) {
        command += ` -t ${params.expireTime}`;
      }

      if (params.appName) {
        command += ` -a "${params.appName}"`;
      }

      if (params.icon) {
        command += ` -i "${params.icon}"`;
      }

      if (params.category) {
        command += ` -c "${params.category}"`;
      }

      // Add summary and body
      command += ` "${params.summary}"`;
      if (params.body) {
        command += ` "${params.body}"`;
      }

      // Execute the command
      const result = await pi.exec("bash", ["-c", command], { signal });

      if (result.code !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to send notification: ${result.stderr || result.stdout}`,
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
