import { dotJoin, countLabel, table, detail, actionLine, stateDot } from "../renderers";
import type { Column } from "../renderers";

// ── Niri JSON types ──────────────────────────────────────

export interface NiriWindow {
  id: number;
  title: string;
  app_id: string;
  workspace_id?: number;
  is_focused?: boolean;
  is_floating?: boolean;
}

export interface NiriWorkspace {
  id: number;
  idx: number;
  name?: string;
  output?: string;
  is_active?: boolean;
  is_focused?: boolean;
  active_window_id?: number;
}

export interface NiriOutput {
  name: string;
  make?: string;
  model?: string;
  serial?: string;
  current_mode?: { width: number; height: number; refresh_rate?: number };
  scale?: number;
  vrr_enabled?: boolean;
}

// ── Formatters ───────────────────────────────────────────

export function formatWindows(windows: NiriWindow[]): string {
  const cols: Column[] = [
    { key: "id", align: "right", minWidth: 4 },
    { key: "app", minWidth: 12 },
    {
      key: "title",
      maxWidth: 50,
      format: (v) => {
        const s = String(v ?? "");
        return s.length > 50 ? s.slice(0, 47) + "..." : s;
      },
    },
    { key: "flags" },
  ];

  const rows = windows.map((w) => {
    const flags: string[] = [];
    if (w.is_focused) flags.push(stateDot("on") + " focused");
    if (w.is_floating) flags.push("float");
    return {
      id: w.id,
      app: w.app_id,
      title: w.title || "",
      flags: flags.join(" "),
    };
  });

  return [dotJoin(countLabel(windows.length, "window")), "", table(cols, rows)].join(
    "\n",
  );
}

export function formatWorkspaces(workspaces: NiriWorkspace[]): string {
  const cols: Column[] = [
    { key: "idx", align: "right", minWidth: 3 },
    { key: "name", minWidth: 8 },
    { key: "output" },
    { key: "status" },
  ];

  const rows = workspaces.map((ws) => {
    const flags: string[] = [];
    if (ws.is_focused) flags.push(stateDot("on") + " focused");
    else if (ws.is_active) flags.push(stateDot("on") + " active");
    return {
      idx: ws.idx,
      name: ws.name || "",
      output: ws.output || "",
      status: flags.join(" "),
    };
  });

  return [
    dotJoin(countLabel(workspaces.length, "workspace")),
    "",
    table(cols, rows),
  ].join("\n");
}

export function formatOutputs(outputs: NiriOutput[]): string {
  const cols: Column[] = [
    { key: "name", minWidth: 8 },
    { key: "resolution" },
    { key: "scale", align: "right" },
    { key: "vrr" },
  ];

  const rows = outputs.map((o) => {
    const mode = o.current_mode;
    const res = mode ? `${mode.width}x${mode.height}` : "";
    const refresh = mode?.refresh_rate
      ? `@${Math.round(mode.refresh_rate / 1000)}Hz`
      : "";
    return {
      name: o.name,
      resolution: res + refresh,
      scale: o.scale ? `${o.scale}x` : "",
      vrr: `${stateDot(o.vrr_enabled ?? false)} vrr`,
    };
  });

  return [dotJoin(countLabel(outputs.length, "output")), "", table(cols, rows)].join(
    "\n",
  );
}

export function formatFocusedWindow(w: NiriWindow | null): string {
  if (!w) return "No focused window";

  return detail([
    { label: "id", value: String(w.id) },
    { label: "app", value: w.app_id },
    { label: "title", value: w.title || "untitled" },
    ...(w.workspace_id !== undefined
      ? [{ label: "workspace", value: String(w.workspace_id) }]
      : []),
    ...(w.is_floating ? [{ label: "floating", value: "yes" }] : []),
  ]);
}

export function formatFocusedOutput(o: NiriOutput | null): string {
  if (!o) return "No focused output";

  const mode = o.current_mode;
  return detail([
    { label: "name", value: o.name },
    ...(o.make ? [{ label: "make", value: o.make }] : []),
    ...(o.model ? [{ label: "model", value: o.model }] : []),
    ...(mode
      ? [
          {
            label: "mode",
            value: `${mode.width}x${mode.height}${mode.refresh_rate ? `@${Math.round(mode.refresh_rate / 1000)}Hz` : ""}`,
          },
        ]
      : []),
    ...(o.scale ? [{ label: "scale", value: `${o.scale}x` }] : []),
    { label: "vrr", value: `${stateDot(o.vrr_enabled ?? false)} vrr` },
  ]);
}

export function formatPickedWindow(w: NiriWindow | null): string {
  if (!w) return "No window picked";
  return formatFocusedWindow(w);
}

export function formatPickedColor(color: string | null): string {
  if (!color) return "No color picked";
  return actionLine("Picked color", color);
}

export function formatScreenshotDone(path?: string): string {
  if (path) return actionLine("Screenshot saved", path);
  return "Screenshot taken";
}
