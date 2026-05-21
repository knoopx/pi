/**
 * Llama.cpp Progress Tracker
 *
 * Tails podman-llm.service journalctl logs for llama.cpp prompt progress.
 * Shows a progress bar above the prompt input while loading, hides when done.
 */

import { spawn } from "node:child_process";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "llama-progress";

export const PATTERNS = {
  proxying: /proxying request to model/,
  progress: /progress\s*=\s*(\d[\d.]*)/,
};

export function parseLine(
  line: string,
  progress: number | null,
): number | null {
  if (line.match(PATTERNS.proxying)) return 0;

  const m = line.match(PATTERNS.progress);
  if (m) return parseFloat(m[1]);

  return progress;
}

class ProgressWidget implements Component {
  private tui: TUI;
  private theme: Theme;
  private progress: number | null;

  constructor(tui: TUI, theme: Theme, progress: number | null) {
    this.tui = tui;
    this.theme = theme;
    this.progress = progress;
  }

  update(progress: number | null): void {
    this.progress = progress;
    this.tui.requestRender();
  }

  render(_width: number): string[] {
    if (this.progress === null) return [];

    const barLen = 20;
    const filled = Math.max(1, Math.round(this.progress * barLen));
    const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
    return [this.theme.fg("dim", bar)];
  }

  invalidate(): void {}

  dispose(): void {}
}

export default function (pi: ExtensionAPI) {
  let journalProc: ReturnType<typeof spawn> | null = null;
  let activeWidget: ProgressWidget | null = null;
  let currentProgress: number | null = null;
  let ctxRef: ExtensionContext | null = null;
  let isShuttingDown = false;

  const startJournalWatch = () => {
    if (journalProc) return;

    journalProc = spawn("journalctl", ["-f", "-u", "podman-llm.service"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    journalProc.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const progress = parseLine(line, currentProgress);
        currentProgress = progress;

        if (activeWidget) {
          activeWidget.update(progress);
        }
      }
    });

    journalProc.stderr?.on("data", () => {});
    journalProc.on("exit", () => {
      journalProc = null;
    });
  };

  const stopJournalWatch = () => {
    if (journalProc) {
      journalProc.kill();
      journalProc = null;
    }
  };

  const hideWidget = () => {
    currentProgress = null;
    if (activeWidget) {
      activeWidget.dispose();
      activeWidget = null;
    }
    if (ctxRef?.hasUI) {
      ctxRef.ui.setWidget(WIDGET_KEY, []);
    }
  };

  const updateWidget = () => {
    if (isShuttingDown || !ctxRef || !ctxRef.hasUI) return;

    if (currentProgress !== null) {
      ctxRef.ui.setWidget(WIDGET_KEY, (tui, theme) => {
        activeWidget = new ProgressWidget(tui, theme, currentProgress);
        return activeWidget;
      });
    } else {
      hideWidget();
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    ctxRef = ctx;
    startJournalWatch();
  });

  pi.on("input", async (_event, ctx) => {
    // Show progress widget right after user input is received.
    currentProgress = 0;
    if (ctx.hasUI) {
      updateWidget();
    }
  });

  pi.on("message_start", async (event, _ctx) => {
    // Hide when the assistant message arrives — prompt processing is done.
    if (event.message.role === "assistant") {
      hideWidget();
    }
  });

  pi.on("session_shutdown", async () => {
    isShuttingDown = true;
    stopJournalWatch();
    ctxRef = null;
    if (activeWidget) {
      activeWidget.dispose();
      activeWidget = null;
    }
    currentProgress = null;
  });
}
