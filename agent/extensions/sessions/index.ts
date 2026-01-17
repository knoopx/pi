import type { ExtensionAPI, OnUpdate, ToolContext } from "@mariozechner/pi-coding-agent";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface SessionEntry {
  type: string;
  message?: {
    role: string;
    content: Array<{ type: string; text: string }>;
  };
}

function getAllJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllJsonlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
  return files;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("sessions", {
    description:
      "Browse previous sessions sorted by most recent and restore them",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("sessions requires interactive mode", "error");
        return;
      }

      // Get list of all session files from all session directories sorted by mtime desc
      const sessionsRoot = join(homedir(), ".pi", "agent", "sessions");

      let files: string[] = [];
      try {
        files = getAllJsonlFiles(sessionsRoot);
      } catch {
        ctx.ui.notify("No previous sessions found", "info");
        return;
      }

      if (files.length === 0) {
        ctx.ui.notify("No previous sessions found", "info");
        return;
      }

      // Get mtime for each
      const withStats = files
        .map((f) => ({ path: f, mtime: statSync(f).mtime.getTime() }))
        .sort((a, b) => b.mtime - a.mtime);

      // For each session, get preview
      const options: string[] = [];
      const paths: string[] = [];

      for (const { path, mtime } of withStats.slice(0, 20)) {
        // limit to 10
        const date = new Date(mtime).toLocaleString();

        let preview = "No preview";
        try {
          const content = readFileSync(path, "utf8");
          const entries = content.split("\n").filter(Boolean).slice(0, 20);
          for (const entry of entries) {
            try {
              const json: SessionEntry = JSON.parse(entry);
              if (json.type === "message" && json.message?.role === "user") {
                const text = json.message.content?.[0]?.text || "";
                preview =
                  text.replace(/\n/g, " ").slice(0, 100) +
                  (text.length > 100 ? "..." : "");
                break;
              }
            } catch {
              // ignore parse errors
            }
          }
        } catch {
          preview = "Error reading file";
        }

        options.push(`${date}: ${preview}`);
        paths.push(path);
      }

      // Show select dialog
      const selectedIndexRaw = await ctx.ui.select(
        "Select a session to restore:",
        options,
      );
      if (selectedIndexRaw === undefined) {
        return; // cancelled
      }

      const selectedIndex = Number(selectedIndexRaw);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
        ctx.ui.notify("Invalid selection", "error");
        return;
      }

      const selectedPath = paths[selectedIndex];
      if (!selectedPath) {
        ctx.ui.notify("Invalid selection", "error");
        return;
      }
      ctx.ui.setEditorText(`/resume ${selectedPath}`);
      ctx.ui.notify("Selected session loaded. Press Enter to restore.", "info");
    },
  });
}
