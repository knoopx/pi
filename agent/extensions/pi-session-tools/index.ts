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
import { fuzzyFilter } from "../../shared/fuzzy";
import {
  dotJoin,
  sectionDivider,
  threadSeparator,
  table,
  passFail,
} from "../renderers";
import type { Column } from "../renderers";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const DEFAULT_SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");

/** Overridable for testing. */
let sessionsDir = DEFAULT_SESSIONS_DIR;

export function setSessionsDir(dir: string): void {
  sessionsDir = dir;
}

export function getSessionsDir(): string {
  return sessionsDir;
}

interface SessionProject {
  id: string;
  sessionsPath: string;
  displayPath: string;
  cwdPath: string;
  sessionCount: number;
  latestSessionIso: string | null;
  createdIso: string;
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
  role: "user" | "bash" | "assistant" | "toolResult";
  text: string;
}

interface ToolCall {
  sessionPath: string;
  timestampIso: string;
  toolName: string;
  toolKey: string;
  command: string | null;
  isError: boolean;
  resultText: string;
}

interface ToolCallsParams {
  project: string;
  tool?: string;
  resultQuery?: string;
  errorsOnly?: boolean;
  days?: number;
  from?: string;
  to?: string;
  limit?: number;
}

interface ReadSessionParams {
  session: string;
  project: string;
  offset?: number;
  limit?: number;
  role?: string;
  query?: string;
}

interface SessionMessage {
  index: number;
  timestampIso: string | null;
  role: string;
  toolName: string | null;
  isError: boolean;
  text: string;
}

interface ListProjectsParams {
  query?: string;
  limit?: number;
}

interface ListSessionsParams {
  project: string;
  query?: string;
  limit?: number;
}

interface SessionEventsParams {
  project: string;
  query?: string;
  role?: string;
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
  const sessionsPath = join(sessionsDir, dirName);
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

  // Get project creation date from the directory itself
  const dirStat = await stat(sessionsPath);
  const createdIso = dirStat.birthtime.toISOString();

  return {
    id: dirName,
    sessionsPath,
    displayPath,
    cwdPath,
    sessionCount: jsonlFiles.length,
    latestSessionIso: toIsoOrNull(latestSessionDate),
    createdIso,
    totalSizeBytes,
  };
}

async function loadProjects(): Promise<SessionProject[]> {
  const entries = await readdir(sessionsDir, { withFileTypes: true });
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
  project: string,
): Promise<SessionProject | null> {
  const projects = await loadProjects();
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
    `${theme.fg("toolTitle", toolName)} ${theme.fg("dim", value)}`,
    0,
    0,
  );
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
          message?.role === "bashExecution" &&
          typeof message.command === "string"
        ) {
          const text = truncateLine(message.command, 500);
          if (text) {
            events.push({
              sessionPath,
              timestampIso: timestamp.toISOString(),
              role: "bash",
              text,
            });
          }
          continue;
        }

        if (message?.role === "assistant") {
          const text = truncateLine(
            getUserTextFromContent(message.content),
            500,
          );
          if (text) {
            events.push({
              sessionPath,
              timestampIso: timestamp.toISOString(),
              role: "assistant",
              text,
            });
          }
          continue;
        }

        if (message?.role === "toolResult") {
          const text = truncateLine(
            getUserTextFromContent(message.content),
            500,
          );
          if (text) {
            events.push({
              sessionPath,
              timestampIso: timestamp.toISOString(),
              role: "toolResult",
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

function getToolKey(toolName: string, command: string | null): string {
  if (toolName === "bash" && command) {
    const firstWord = command.split(/\s+/)[0];
    return `bash:${firstWord}`;
  }
  return toolName;
}

async function loadSessionToolCalls(
  sessionPath: string,
  fromTimestamp: number,
  toTimestamp: number,
): Promise<ToolCall[]> {
  const handle = await open(sessionPath, "r");

  try {
    const content = await handle.readFile({ encoding: "utf8" });
    const lines = getJsonlLines(content);
    const toolCallArgs: Record<string, { command?: string }> = {};
    const toolCalls: ToolCall[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as SessionLine;
        if (entry.type !== "message") continue;

        const message = entry.message as {
          role?: string;
          toolName?: string;
          toolCallId?: string;
          isError?: boolean;
          content?: (
            | { type: "toolCall"; id?: string; arguments?: { command?: string } }
            | { type: "text"; text?: string }
          )[];
        };

        // Collect toolCall arguments for later correlation
        if (message?.content) {
          for (const c of message.content) {
            if (c.type === "toolCall" && "id" in c && c.id) {
              toolCallArgs[c.id] =
                ("arguments" in c ? c.arguments : undefined) ?? {};
            }
          }
        }

        if (message?.role !== "toolResult") continue;

        const timestamp = parseLineTimestamp(entry);
        if (!timestamp) continue;

        const timestampMs = timestamp.getTime();
        if (timestampMs < fromTimestamp || timestampMs > toTimestamp) continue;

        const toolName = message.toolName ?? "unknown";
        const args = toolCallArgs[message.toolCallId ?? ""];
        const command = args?.command ?? null;
        const isError = message.isError === true;
        const firstContent = message.content?.[0];
        const resultText =
          (firstContent && "text" in firstContent ? firstContent.text : null) ??
          JSON.stringify(message.content);

        toolCalls.push({
          sessionPath,
          timestampIso: timestamp.toISOString(),
          toolName,
          toolKey: getToolKey(toolName, command),
          command,
          isError,
          resultText: truncateLine(resultText, 500),
        });
      } catch {
        continue;
      }
    }

    return toolCalls;
  } finally {
    await handle.close();
  }
}

function extractMessageText(message: {
  role?: string;
  content?: unknown;
  command?: string;
  toolName?: string;
}): string {
  if (message.role === "bashExecution" && message.command) {
    return message.command;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  const textPart = getUserTextFromContent(message.content);
  const toolParts: string[] = [];

  for (const block of message.content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as { type?: string; arguments?: unknown };
    if (b.type === "toolCall" && b.arguments) {
      const args =
        typeof b.arguments === "string"
          ? b.arguments
          : JSON.stringify(b.arguments);
      toolParts.push(`[toolCall: ${args}]`);
    }
  }

  return [textPart, ...toolParts].filter((p) => p.length > 0).join("\n");
}

async function loadSessionMessages(
  sessionPath: string,
): Promise<SessionMessage[]> {
  const handle = await open(sessionPath, "r");

  try {
    const content = await handle.readFile({ encoding: "utf8" });
    const lines = getJsonlLines(content);
    const messages: SessionMessage[] = [];
    let index = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as SessionLine;
        if (entry.type !== "message") continue;

        const message = entry.message as {
          role?: string;
          content?: unknown;
          command?: string;
          toolName?: string;
          isError?: boolean;
        };

        if (!message?.role) continue;

        const timestamp = parseLineTimestamp(entry);
        const text = extractMessageText(message);

        messages.push({
          index,
          timestampIso: timestamp?.toISOString() ?? null,
          role: message.role,
          toolName: message.toolName ?? null,
          isError: message.isError === true,
          text,
        });

        index++;
      } catch {
        continue;
      }
    }

    return messages;
  } finally {
    await handle.close();
  }
}

async function resolveSessionPath(
  project: SessionProject,
  sessionArg: string,
): Promise<string | null> {
  const sessions = await loadProjectSessions(project);

  // Index match first — pure numeric strings like "0", "1" are always indices
  const idx = parseInt(sessionArg, 10);
  if (String(idx) === sessionArg && idx >= 0 && idx < sessions.length) {
    return sessions[idx].sessionPath;
  }

  // Exact filename match
  const byFilename = sessions.find(
    (s) => s.filename === sessionArg || basename(s.sessionPath) === sessionArg,
  );
  if (byFilename) return byFilename.sessionPath;

  // Partial filename match
  const byPartial = sessions.find(
    (s) =>
      s.filename.includes(sessionArg) || s.sessionPath.includes(sessionArg),
  );
  if (byPartial) return byPartial.sessionPath;

  return null;
}

export default function piSessionToolsExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "pi-list-projects",
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
        const query = params.query?.trim() ?? "";
        const limit = normalizeLimit(params.limit);

        const filtered = query
          ? fuzzyFilter(
              allProjects,
              query,
              (p) => `${p.displayPath} ${p.cwdPath}`,
            ).map((r) => r.item)
          : allProjects;

        const projects = filtered.slice(0, limit);

        const projCols: Column[] = [
          { key: "sessions", align: "right", minWidth: 4 },
          { key: "size", align: "right", minWidth: 7 },
          { key: "latest", minWidth: 10 },
          {
            key: "project",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              return r.cwd !== r.project ? `${r.project}\n${r.cwd}` : r.project;
            },
          },
        ];

        const projRows = projects.map((p) => ({
          sessions: String(p.sessionCount),
          size: formatBytes(p.totalSizeBytes),
          latest: p.latestSessionIso
            ? new Date(p.latestSessionIso).toLocaleDateString()
            : "never",
          project: p.displayPath,
          cwd: p.cwdPath,
        }));

        if (projects.length === 0) {
          return textResult("No session projects found.", {
            totalFound: 0,
            projects: [],
          });
        }

        const suffix =
          filtered.length > projects.length ? ` (of ${filtered.length})` : "";

        const text = [
          dotJoin(`${projects.length} projects${suffix}`),
          "",
          table(projCols, projRows),
        ].join("\n");

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
      return renderToolCallLabel(theme, "pi-list-projects", args.query, "all");
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
      project: Type.String({
        description:
          "Project id or path. Accepts encoded dir name, decoded project path, cwd path, or partial match.",
      }),
      query: Type.Optional(
        Type.String({
          description:
            "Filter sessions by title (first user prompt). Fuzzy match.",
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
      _ctx: ExtensionContext,
    ) {
      try {
        const project = await resolveProject(params.project);
        if (!project) {
          return missingProjectResult(params.project, "sessions");
        }

        const allSessions = await loadProjectSessions(project);
        const queryFilter = params.query?.trim() ?? "";
        const limit = normalizeLimit(params.limit);

        const matched = queryFilter
          ? fuzzyFilter(allSessions, queryFilter, (s) => s.title).map(
              (r) => r.item,
            )
          : allSessions;
        const sessions = matched.slice(0, limit);

        if (sessions.length === 0) {
          return textResult(`No sessions found for ${project.displayPath}.`, {
            project,
            totalFound: 0,
            sessions: [],
          });
        }

        const sessCols: Column[] = [
          { key: "size", align: "right", minWidth: 7 },
          { key: "timestamp", minWidth: 18 },
          {
            key: "title",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              return `${r.title}\n${r.file}`;
            },
          },
        ];

        const sessRows = sessions.map((s) => ({
          size: formatBytes(s.sizeBytes),
          timestamp: new Date(s.timestampIso).toLocaleString(),
          title: s.title,
          file: basename(s.sessionPath),
        }));

        const suffix =
          allSessions.length > sessions.length
            ? ` (of ${allSessions.length})`
            : "";

        const text = [
          dotJoin(`${sessions.length} sessions${suffix}`),
          "",
          table(sessCols, sessRows),
        ].join("\n");

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
    name: "pi-session-search",
    label: "Pi Session Search",
    description:
      "Full-text search across all session content in a project. Searches user prompts, assistant responses, bash commands, and tool results. Filter by role and time range.",
    parameters: Type.Object({
      project: Type.String({
        description:
          "Project id or path. Use '*' to search all projects.",
      }),
      query: Type.Optional(
        Type.String({
          description: "Text filter for event content. Fuzzy match.",
        }),
      ),
      role: Type.Optional(
        Type.String({
          description:
            "Filter by role: 'user', 'bash', 'assistant', or 'toolResult'. Returns all roles if omitted.",
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
      _ctx: ExtensionContext,
    ) {
      try {
        const searchAll = params.project.trim() === "*";
        let targetProjects: SessionProject[];

        if (searchAll) {
          targetProjects = await loadProjects();
        } else {
          const project = await resolveProject(params.project);
          if (!project) {
            return missingProjectResult(params.project, "events");
          }
          targetProjects = [project];
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

        const query = params.query?.trim() ?? "";
        const roleFilter = params.role?.trim() ?? "";
        const limit = normalizeLimit(params.limit ?? 50);

        const allEvents: SessionEvent[] = [];

        for (const project of targetProjects) {
          const sessions = await loadProjectSessions(project);
          for (const session of sessions) {
            const events = await loadSessionEvents(
              session.sessionPath,
              fromDate.getTime(),
              toDate.getTime(),
            );
            allEvents.push(...events);
          }
        }

        let sorted = allEvents.sort(
          (left, right) =>
            new Date(right.timestampIso).getTime() -
            new Date(left.timestampIso).getTime(),
        );

        if (roleFilter) {
          sorted = sorted.filter(
            (e) => e.role.toLowerCase() === roleFilter.toLowerCase(),
          );
        }

        const filtered = query
          ? fuzzyFilter(sorted, query, (e) => e.text).map((r) => r.item)
          : sorted;

        const events = filtered.slice(0, limit);

        const scopeLabel = searchAll
          ? "all projects"
          : targetProjects[0].displayPath;

        if (events.length === 0) {
          return textResult(
            `No events found in ${scopeLabel} for the selected filters.`,
            {
              project: searchAll ? "*" : targetProjects[0],
              query,
              role: roleFilter || null,
              from: fromDate.toISOString(),
              to: toDate.toISOString(),
              totalFound: 0,
              events: [],
            },
          );
        }

        const eventCols: Column[] = [
          { key: "role", minWidth: 4 },
          { key: "timestamp", minWidth: 18 },
          {
            key: "text",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              return `${r.text}\n${r.file}`;
            },
          },
        ];

        const eventRows = events.map((e) => ({
          role: e.role,
          timestamp: new Date(e.timestampIso).toLocaleString(),
          text: e.text,
          file: basename(e.sessionPath),
        }));

        const suffix =
          filtered.length > events.length ? ` (of ${filtered.length})` : "";

        const text = [
          dotJoin(`${events.length} events${suffix}`),
          "",
          table(eventCols, eventRows),
        ].join("\n");

        return textResult(text, {
          project: searchAll ? "*" : targetProjects[0],
          query,
          role: roleFilter || null,
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
      return renderToolCallLabel(theme, "pi-session-search", query, "all");
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "pi-tool-calls",
    label: "Pi Tool Calls",
    description:
      "Analyze tool calls from Pi sessions. Shows call counts by tool, with optional error filtering.",
    parameters: Type.Object({
      project: Type.String({
        description: "Project id or path.",
      }),
      tool: Type.Optional(
        Type.String({
          description:
            "Filter by tool name or command prefix (e.g., 'bash', 'edit', 'bash:jj').",
        }),
      ),
      errorsOnly: Type.Optional(
        Type.Boolean({
          description: "Only show failed tool calls (default: false).",
        }),
      ),
      days: Type.Optional(
        Type.Number({
          description: "Days to look back (default: 7).",
          minimum: 1,
          maximum: 365,
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results (default: 50).",
          minimum: 1,
          maximum: MAX_LIMIT,
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: ToolCallsParams,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const project = await resolveProject(params.project);
        if (!project) {
          return textResult("No matching session project found.", {
            project: params.project,
            calls: [],
            summary: {},
          });
        }

        const days = params.days ?? 7;
        const now = new Date();
        const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const toolFilter = params.tool?.trim() ?? "";
        const errorsOnly = params.errorsOnly === true;
        const limit = normalizeLimit(params.limit ?? 50);

        const sessions = await loadProjectSessions(project);
        const allCalls: ToolCall[] = [];

        for (const session of sessions) {
          const calls = await loadSessionToolCalls(
            session.sessionPath,
            fromDate.getTime(),
            now.getTime(),
          );
          allCalls.push(...calls);
        }

        let filtered = allCalls;

        if (errorsOnly) {
          filtered = filtered.filter((c) => c.isError);
        }

        if (toolFilter) {
          filtered = fuzzyFilter(
            filtered,
            toolFilter,
            (c) => `${c.toolKey} ${c.command ?? ""}`,
          ).map((r) => r.item);
        }

        filtered.sort(
          (a, b) =>
            new Date(b.timestampIso).getTime() -
            new Date(a.timestampIso).getTime(),
        );

        const summary: Record<string, { total: number; errors: number }> = {};
        for (const call of filtered) {
          if (!summary[call.toolKey]) {
            summary[call.toolKey] = { total: 0, errors: 0 };
          }
          summary[call.toolKey].total++;
          if (call.isError) {
            summary[call.toolKey].errors++;
          }
        }

        // Summary table
        const summaryCols: Column[] = [
          { key: "calls", align: "right", minWidth: 5 },
          { key: "errors", align: "right", minWidth: 6 },
          { key: "tool" },
        ];

        const summaryRows = Object.entries(summary)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([key, counts]) => ({
            calls: String(counts.total),
            errors: counts.errors > 0 ? String(counts.errors) : "0",
            tool: key,
          }));

        // Recent calls table
        const calls = filtered.slice(0, limit);
        const callCols: Column[] = [
          { key: "status", minWidth: 1 },
          { key: "timestamp", minWidth: 18 },
          {
            key: "tool",
            format: (_v, row) => {
              const r = row as Record<string, string>;
              return r.result ? `${r.tool}\n${r.result}` : r.tool;
            },
          },
        ];

        const callRows = calls.map((call) => ({
          status: passFail(!call.isError),
          timestamp: new Date(call.timestampIso).toLocaleString(),
          tool:
            call.toolName === "bash" && call.command
              ? `bash: ${truncateLine(call.command, 60)}`
              : call.toolName,
          result: call.isError ? call.resultText : "",
        }));

        const suffix =
          filtered.length > limit ? ` (of ${filtered.length})` : "";

        const sections: string[] = [
          dotJoin(`${filtered.length} calls${suffix}`),
        ];

        if (summaryRows.length > 0) {
          sections.push(
            "",
            sectionDivider("Summary"),
            table(summaryCols, summaryRows),
          );
        }

        if (callRows.length > 0) {
          sections.push(
            "",
            sectionDivider("Recent"),
            table(callCols, callRows),
          );
        } else {
          sections.push("", "No matching tool calls found.");
        }

        return textResult(sections.join("\n"), {
          project: project.displayPath,
          days,
          errorsOnly,
          tool: toolFilter || null,
          totalFound: filtered.length,
          summary,
          calls,
        });
      } catch (error) {
        return errorResult(getErrorMessage(error));
      }
    },
    renderCall(args, theme) {
      const label = args.errorsOnly ? "errors" : (args.tool ?? "all");
      return renderToolCallLabel(theme, "pi-tool-calls", label, "all");
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });

  pi.registerTool({
    name: "pi-read-session",
    label: "Pi Read Session",
    description:
      "Read messages from a Pi session file with offset/limit pagination and filtering by role or content.",
    parameters: Type.Object({
      session: Type.String({
        description:
          "Session identifier: filename, partial match, or index (0=most recent).",
      }),
      project: Type.String({
        description: "Project id or path.",
      }),
      offset: Type.Optional(
        Type.Number({
          description: "Message index to start from (0-indexed, default: 0).",
          minimum: 0,
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum messages to return (default: 20).",
          minimum: 1,
          maximum: MAX_LIMIT,
        }),
      ),
      role: Type.Optional(
        Type.String({
          description:
            "Filter by role: user, assistant, toolResult, bashExecution.",
        }),
      ),
      query: Type.Optional(
        Type.String({
          description: "Case-insensitive text filter for message content.",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: ReadSessionParams,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const project = await resolveProject(params.project);
        if (!project) {
          return textResult("No matching session project found.", {
            project: params.project,
            session: params.session,
            messages: [],
          });
        }

        const sessionPath = await resolveSessionPath(project, params.session);
        if (!sessionPath) {
          return textResult(
            `Session not found: ${params.session}. Use pi-list-sessions to see available sessions.`,
            {
              project: project.displayPath,
              session: params.session,
              messages: [],
            },
          );
        }

        const allMessages = await loadSessionMessages(sessionPath);
        const roleFilter = params.role?.toLowerCase() ?? "";
        const queryFilter = params.query?.trim() ?? "";

        let filtered = allMessages;

        if (roleFilter) {
          filtered = filtered.filter((m) =>
            m.role.toLowerCase().includes(roleFilter),
          );
        }

        if (queryFilter) {
          filtered = fuzzyFilter(filtered, queryFilter, (m) => m.text).map(
            (r) => r.item,
          );
        }

        const offset = params.offset ?? 0;
        const limit = normalizeLimit(params.limit);
        const sliced = filtered.slice(offset, offset + limit);

        const lines = sliced.map((msg) => {
          const stamp = msg.timestampIso
            ? new Date(msg.timestampIso).toLocaleString()
            : "?";
          const status = msg.isError ? ` ✗` : "";
          const tool = msg.toolName ? ` [${msg.toolName}]` : "";
          const text = msg.text;
          return [
            threadSeparator(`#${msg.index} ${msg.role}${tool}${status}`, stamp),
            text,
          ].join("\n");
        });

        const hasMore = offset + limit < filtered.length;
        const end = offset + sliced.length;
        const rangeInfo =
          sliced.length === 0
            ? `0 of ${filtered.length}`
            : `${offset}–${end - 1} of ${filtered.length}`;
        const nextHint = hasMore
          ? `\nUse offset=${offset + limit} to continue.`
          : "";

        const text = [dotJoin(rangeInfo), "", ...lines, nextHint].join("\n");

        return textResult(text, {
          project: project.displayPath,
          sessionPath,
          totalMessages: allMessages.length,
          filteredCount: filtered.length,
          offset,
          limit,
          hasMore,
          messages: sliced,
        });
      } catch (error) {
        return errorResult(getErrorMessage(error));
      }
    },
    renderCall(args, theme) {
      return renderToolCallLabel(theme, "pi-read-session", args.session, "?");
    },
    renderResult(result, _options, theme) {
      return renderTextToolResult(result, theme);
    },
  });
}
