/**
 * Workspace monitoring for agent completion notifications.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { loadAgentWorkspaces } from "../workspace";
import { formatFileStats } from "../types";

const CHECK_INTERVAL = 5000;
const MAX_WAIT = 3600000;

export async function monitorWorkspace(
  pi: ExtensionAPI,
  workspaceName: string,
  ctx: ExtensionContext,
): Promise<void> {
  const startTime = Date.now();

  const check = async (): Promise<void> => {
    if (Date.now() - startTime > MAX_WAIT) return;

    try {
      const workspaces = await loadAgentWorkspaces(pi);
      const ws = workspaces.find((w) => w.name === workspaceName);

      if (!ws) return;

      if (ws.status !== "running") {
        const stats = formatFileStats(ws);
        const statusText = ws.status === "completed" ? "completed" : ws.status;

        if (ctx.hasUI) ctx.ui.notify(
          `Agent ${workspaceName} ${statusText} ${stats}`,
          ws.status === "completed" ? "info" : "warning",
        );

        await pi.exec("notify-send", [
          "-a",
          "IDE",
          `Agent ${statusText}`,
          `${ws.description}\n${stats}`,
        ]);

        return;
      }

      setTimeout(() => void check(), CHECK_INTERVAL);
    } catch {
      setTimeout(() => void check(), CHECK_INTERVAL);
    }
  };

  setTimeout(() => void check(), CHECK_INTERVAL);
}
