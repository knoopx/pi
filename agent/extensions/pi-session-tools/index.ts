import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readdir, stat, open } from "node:fs/promises";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { Text } from "@mariozechner/pi-tui";
import { renderTextToolResult } from "../../shared/render-utils";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");

interface SessionProject {
  id: string;
  sessionsPath: string;
  displayPath: string;
  cwdPath: string;
  sessionCount: number;
  latestSessionIso: string | null;
  totalSizeBytes: number;
}

interface SessionFileSummary {
  filename: string;
  sessionPath: string;
  timestampIso: string;
  title: string;
  sizeBytes: number;
}

interface SessionEvent {
  sessionPath: string;
  timestampIso: string;
  role: "user" | "userBashCommand";
  text: string;
}

interface ListProjectsParams {
  query?: string;
  limit?: number;
}

interface ListSessionsParams {
  project?: string;
  limit?: number;
}

interface SessionEventsParams {
  project?: string;
  query?: string;
  from?: string;
  to?: string;
  limit?: number;
}

interface SessionMessageLine {
  role?: unknown;
  timestamp?: unknown;
  command?: unknown;
  content?: unknown;
}

interface SessionLine {
  type?: unknown;
  timestamp?: unknown;
  cwd?: unknown;
  message?: unknown;
}

function asSessionMessage(message: unknown): SessionMessageLine | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  return message as SessionMessageLine;
}

export function decodeSessionPath(dirName: string): string {
  const trimmed = dirName.replace(/^--/, "").replace(/--$/, "");
  return `/${trimmed.replace(/-/g, "/")}`;
}

async function readSessionSummary(sessionPath: string): Promise<{
  cwdPath: string | null;
  title: string | null;
  latestTimestamp: Date | null;
}> {
  const handle = await open(sessionPath, "r");

  try {
    const content = await handle.readFile({ encoding: "utf8" });
    const lines = getJsonlLines(content);

    let cwdPath: string | null = null;
    let title: string | null = null;
    let latestTimestamp: Date | null = null;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as SessionLine;

        if (
          !cwdPath &&
          entry.type === "session" &&
          typeof entry.cwd === "string"
        ) {
          cwdPath = entry.cwd;
        }

        const message = asSessionMessage(entry.message);
        if (
          !title &&
          entry.type === "message" &&
          message?.role === "user" &&
          Array.isArray(message.content)
        ) {
          const text = getUserTextFromContent(message.content);
          if (text) {
            title = truncateLine(text, 100);
          }
        }

        const timestamp = parseLineTimestamp(entry);
        if (timestamp && (!latestTimestamp || timestamp > latestTimestamp)) {
          latestTimestamp = timestamp;
        }
      } catch {
        continue;
      }
    }

    return {
      cwdPath,
      title,
      latestTimestamp,
    };
  } finally {
    await handle.close();
  }
}

function getJsonlLines(content: string): string[] {
  const rows = content.split("\n");
  const lines: string[] = [];

  for (const row of rows) {
    if (row.trim().length > 0) {
      lines.push(row);
    }
  }

  return lines;
}

function toIsoOrNull(date: Date | null): string | null {
  if (!date) {
    return null;
  }

  return date.toISOString();
}

function parseLineTimestamp(line: SessionLine): Date | null {
  const message = asSessionMessage(line.message);
  const candidates: unknown[] = [line.timestamp, message?.timestamp];

  for (const value of candidates) {
    if (typeof value !== "string" && typeof value !== "number") {
      continue;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exp;

  return `${value.toFixed(value >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function truncateLine(text: string, maxLength = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLength) {
    return oneLine;
  }

  return `${oneLine.slice(0, maxLength - 1)}…`;
}

function getUserTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  const parts = content
    .map((block) => {
      if (typeof block !== "object" || block === null) {
        return "";
      }

      const value = block as { type?: unknown; text?: unknown };
      return value.type === "text" && typeof value.text === "string"
        ? value.text
        : "";
    })
    .filter((part) => part.length > 0);

  return parts.join("\n").trim();
}

async function getProjectInfo(dirName: string): Promise<SessionProject> {
  const sessionsPath = join(SESSIONS_DIR, dirName);
  const displayPath = decodeSessionPath(dirName);

  const files = await readdir(sessionsPath);
  const jsonlFiles = files.filter((name) => name.endsWith(".jsonl"));

  let latestSessionDate: Date | null = null;
  let latestSessionPath: string | null = null;
  let totalSizeBytes = 0;

  for (const file of jsonlFiles) {
    const filePath = join(sessionsPath, file);
    const fileStat = await stat(filePath);
    totalSizeBytes += fileStat.size;

    const fileDate = fileStat.mtime;
    if (!latestSessionDate || fileDate > latestSessionDate) {
      latestSessionDate = fileDate;
      latestSessionPath = filePath;
    }
  }

  let cwdPath = displayPath;
  if (latestSessionPath) {
    try {
      const summary = await readSessionSummary(latestSessionPath);
      if (summary.cwdPath) {
        cwdPath = summary.cwdPath;
      }
    } catch {
      cwdPath = displayPath;
    }
  }

  return {
    id: dirName,
    sessionsPath,
    displayPath,
    cwdPath,
    sessionCount: jsonlFiles.length,
    latestSessionIso: toIsoOrNull(latestSessionDate),
    totalSizeBytes,
  };
}

async function loadProjects(): Promise<SessionProject[]> {
  const entries = await readdir(SESSIONS_DIR, { withFileTypes: true });
  const projectDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("--"))
    .map((entry) => entry.name);

  const projects = await Promise.all(
    projectDirs.map((dirName) => getProjectInfo(dirName)),
  );

  return projects.sort((left, right) => {
    if (!left.latestSessionIso) {
      return 1;
    }

    if (!right.latestSessionIso) {
      return -1;
    }

    return (
      new Date(right.latestSessionIso).getTime() -
      new Date(left.latestSessionIso).getTime()
    );
  });
}

async function resolveProject(
  ctx: ExtensionContext,
  project: string | undefined,
): Promise<SessionProject | null> {
  const projects = await loadProjects();

  if (!project || project.trim().length === 0) {
    return (
      projects.find(
        (item) => item.cwdPath === ctx.cwd || item.displayPath === ctx.cwd,
      ) ?? null
    );
  }

  const search = project.trim();
  return (
    projects.find((item) => item.id === search) ??
    projects.find((item) => item.displayPath === search) ??
    projects.find((item) => item.cwdPath === search) ??
    projects.find(
      (item) =>
        item.displayPath.includes(search) || item.cwdPath.includes(search),
    ) ??
    null
  );
}

async function loadProjectSessions(
  project: SessionProject,
): Promise<SessionFileSummary[]> {
  const files = await readdir(project.sessionsPath);
  const jsonlFiles = files.filter((name) => name.endsWith(".jsonl"));

  const sessions: SessionFileSummary[] = [];

  for (const filename of jsonlFiles) {
    const sessionPath = join(project.sessionsPath, filename);
    const fileStat = await stat(sessionPath);

    let title = "Untitled session";
    let timestamp = fileStat.mtime;

    try {
      const summary = await readSessionSummary(sessionPath);
      if (summary.title) {
        title = summary.title;
      }
      if (summary.latestTimestamp) {
        timestamp = summary.latestTimestamp;
      }
    } catch {
      title = "Untitled session";
      timestamp = fileStat.mtime;
    }

    sessions.push({
      filename,
      sessionPath,
      timestampIso: timestamp.toISOString(),
      title,
      sizeBytes: fileStat.size,
    });
  }

  return sessions.sort(
    (left, right) =>
      new Date(right.timestampIso).getTime() -
      new Date(left.timestampIso).getTime(),
  );
}

function textResult<T>(text: string, details: T): AgentToolResult<T> {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function errorResult(message: string): AgentToolResult<{ error: string }> {
  return textResult(`Error: ${message}`, { error: message });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function missingProjectResult(
  project: string | undefined,
  key: "sessions" | "events",
): AgentToolResult<{ project: string | null; sessions?: []; events?: [] }> {
  if (key === "sessions") {
    return textResult("No matching session project found.", {
      project: project ?? null,
      sessions: [],
    });
  }

  return textResult("No matching session project found.", {
    project: project ?? null,
    events: [],
  });
}

async function resolveProjectForTool(
  ctx: ExtensionContext,
  projectArg: string | undefined,
): Promise<SessionProject | null> {
  return resolveProject(ctx, projectArg);
}

function buildListResponseText(options: {
  lines: string[];
  emptyText: string;
  totalCount: number;
  shownCount: number;
  summaryLabel: string;
}): string {
  const { lines, emptyText, totalCount, shownCount, summaryLabel } = options;

  if (lines.length === 0) {
    return emptyText;
  }

  const suffix =
    totalCount > shownCount ? ` (showing first ${shownCount})` : "";
  return `${lines.join("\n")}\n\n${totalCount} ${summaryLabel}${suffix}`;
}

function renderToolCallLabel(
  theme: Theme,
  toolName: string,
  rawValue: unknown,
  fallbackValue: string,
): Text {
  const value =
    typeof rawValue === "string" && rawValue.trim().length > 0
      ? rawValue
      : fallbackValue;
  return new Text(
    `${theme.fg("toolTitle", theme.bold(toolName))} ${theme.fg("dim", value)}`,
    0,
    0,
  );
}

function extractAction(text: string): string {
  const clean = text
    .replace(/^(implement|fix|add|continue|work on|refactor|improve)\s+/i, "")
    .replace(/\.$/, "")
    .trim();
  return clean.length > 100 ? `${clean.slice(0, 97)}…` : clean;
}
async function loadSessionEvents(
  sessionPath: string,
  fromTimestamp: number,
  toTimestamp: number,
): Promise<SessionEvent[]> {
  const handle = await open(sessionPath, "r");

  try {
    const content = await handle.readFile({ encoding: "utf8" });
    const lines = getJsonlLines(content);
    const events: SessionEvent[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as SessionLine;
        if (entry.type !== "message") {
          continue;
        }

        const timestamp = parseLineTimestamp(entry);
        if (!timestamp) {
          continue;
        }

        const timestampMs = timestamp.getTime();
        if (timestampMs < fromTimestamp || timestampMs > toTimestamp) {
          continue;
        }

        const message = asSessionMessage(entry.message);

        if (message?.role === "user") {
          const text = truncateLine(
            getUserTextFromContent(message.content),
            500,
          );
          if (text) {
            events.push({
              sessionPath,
              timestampIso: timestamp.toISOString(),
              role: "user",
              text,
            });
          }
          continue;
        }

        if (
          message?.role === "userBashCommand" &&
          typeof message.command === "string"
        ) {
          const text = truncateLine(message.command, 500);
          if (text) {
            events.push({
              sessionPath,
              timestampIso: timestamp.toISOString(),
              role: "userBashCommand",
              text,
            });
          }
        }
      } catch {
        continue;
      }
    }

    return events;
  } finally {
    await handle.close();
  }
}

export default function piSessionToolsExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "pi-list-session-projects",
    label: "Pi Session Projects",
    description:
      "List Pi session projects from ~/.pi/agent/sessions with session counts, size, and latest activity.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description: "Optional text filter for decoded project path or cwd",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of projects to return (default: 20)",
          minimum: 1,
          maximum: MAX_LIMIT,
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: ListProjectsParams,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const allProjects = await loadProjects();
        const query = params.query?.trim().toLowerCase() ?? "";
        const limit = normalizeLimit(params.limit);

        const filtered = query
          ? allProjects.filter(
              (project) =>
                project.displayPath.toLowerCase().includes(query) ||
                project.cwdPath.toLowerCase().includes(query),
            )
          : allProjects;

        const projects = filtered.slice(0, limit);

        const lines = projects.map((project) => {
          const latest = project.latestSessionIso
            ? new Date(project.latestSessionIso).toLocaleString()
            : "never";

          return `• ${project.displayPath} | cwd=${project.cwdPath} | sessions=${project.sessionCount} | size=${formatBytes(project.totalSizeBytes)} | latest=${latest}`;
        });

        const text = buildListResponseText({
          lines,
          emptyText: "No session projects found.",
          totalCount: filtered.length,
          shownCount: projects.length,
          summaryLabel: "project(s)",
        });

        return textResult(text, {
          query,
          totalFound: filtered.length,
          projects,
        });
      } catch (error) {
        return errorResult(getErrorMessage(error));
      }
    },
    renderCall(args, theme) {
      return renderToolCallLabel(
        theme,
        "pi-list-session-projects",
        args.query,
        "all",
      );
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "pi-list-sessions",
    label: "Pi Sessions",
    description:
      "List session files for a Pi project. Defaults to the project that matches the current cwd.",
    parameters: Type.Object({
      project: Type.Optional(
        Type.String({
          description:
            "Project id or path. Accepts encoded dir name, decoded project path, cwd path, or partial match.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of sessions to return (default: 20)",
          minimum: 1,
          maximum: MAX_LIMIT,
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: ListSessionsParams,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      ctx: ExtensionContext,
    ) {
      try {
        const project = await resolveProjectForTool(ctx, params.project);
        if (!project) {
          return missingProjectResult(params.project, "sessions");
        }

        const allSessions = await loadProjectSessions(project);
        const limit = normalizeLimit(params.limit);
        const sessions = allSessions.slice(0, limit);

        const lines = sessions.map((session) => {
          const fileName = basename(session.sessionPath);
          const timestamp = new Date(session.timestampIso).toLocaleString();
          return `• ${timestamp} | ${session.title} | ${formatBytes(session.sizeBytes)} | ${fileName}`;
        });

        const text = buildListResponseText({
          lines,
          emptyText: `No sessions found for ${project.displayPath}.`,
          totalCount: allSessions.length,
          shownCount: sessions.length,
          summaryLabel: `session(s) for ${project.displayPath}`,
        });

        return textResult(text, {
          project,
          totalFound: allSessions.length,
          sessions,
        });
      } catch (error) {
        return errorResult(getErrorMessage(error));
      }
    },
    renderCall(args, theme) {
      return renderToolCallLabel(
        theme,
        "pi-list-sessions",
        args.project,
        "cwd",
      );
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "pi-session-events",
    label: "Pi Session Events",
    description:
      "Search user prompts and bash commands from Pi sessions in a project and time range.",
    parameters: Type.Object({
      project: Type.Optional(
        Type.String({
          description: "Project id or path. Defaults to current cwd project.",
        }),
      ),
      query: Type.Optional(
        Type.String({
          description: "Optional case-insensitive text filter for event text.",
        }),
      ),
      from: Type.Optional(
        Type.String({
          description: "Start timestamp (ISO 8601). Defaults to 7 days ago.",
        }),
      ),
      to: Type.Optional(
        Type.String({
          description: "End timestamp (ISO 8601). Defaults to now.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of events to return (default: 50)",
          minimum: 1,
          maximum: MAX_LIMIT,
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: SessionEventsParams,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      ctx: ExtensionContext,
    ) {
      try {
        const project = await resolveProject(ctx, params.project);
        if (!project) {
          return missingProjectResult(params.project, "events");
        }

        const now = new Date();
        const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fromDate = params.from ? new Date(params.from) : defaultFrom;
        const toDate = params.to ? new Date(params.to) : now;

        if (
          Number.isNaN(fromDate.getTime()) ||
          Number.isNaN(toDate.getTime())
        ) {
          return errorResult("Invalid from/to timestamp. Use ISO 8601 values.");
        }

        const query = params.query?.trim().toLowerCase() ?? "";
        const limit = normalizeLimit(params.limit ?? 50);

        const sessions = await loadProjectSessions(project);
        const allEvents: SessionEvent[] = [];

        for (const session of sessions) {
          const events = await loadSessionEvents(
            session.sessionPath,
            fromDate.getTime(),
            toDate.getTime(),
          );
          allEvents.push(...events);
        }

        const sorted = allEvents.sort(
          (left, right) =>
            new Date(right.timestampIso).getTime() -
            new Date(left.timestampIso).getTime(),
        );

        const filtered = query
          ? sorted.filter((event) => event.text.toLowerCase().includes(query))
          : sorted;

        const events = filtered.slice(0, limit);
        const lines = events.map((event) => {
          const stamp = new Date(event.timestampIso).toLocaleString();
          const label = event.role === "user" ? "user" : "bash";
          return `• ${stamp} | ${label} | ${event.text} | ${basename(event.sessionPath)}`;
        });

        const text = buildListResponseText({
          lines,
          emptyText: `No events found in ${project.displayPath} for the selected filters.`,
          totalCount: filtered.length,
          shownCount: events.length,
          summaryLabel: `event(s) in ${project.displayPath}`,
        });

        return textResult(text, {
          project,
          query,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          totalFound: filtered.length,
          events,
        });
      } catch (error) {
        return errorResult(getErrorMessage(error));
      }
    },
    renderCall(args, theme) {
      const query =
        typeof args.query === "string" && args.query.trim().length > 0
          ? args.query
          : "all";
      return renderToolCallLabel(theme, "pi-session-events", query, "all");
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });
}
