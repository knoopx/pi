export interface HistoryEntry {
  content: string;
  preview?: string;
  timestamp: number;
  type: "command" | "message";
}

export interface SessionMessageLine {
  role?: unknown;
  timestamp?: unknown;
  command?: unknown;
  content?: unknown;
}

export interface SessionLine {
  type?: unknown;
  timestamp?: unknown;
  cwd?: unknown;
  message?: unknown;
}

export interface ProcessSessionFileOpts {
  targetCwd: string;
  cutoffTimestamp: number;
  history: HistoryEntry[];
  seen: Set<string>;
}

export interface HistoryFilter {
  name: string;
  type: "command" | "message";
}
