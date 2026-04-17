export interface ToolCall {
  name: string;
  sessionId: string;
  timestamp: string;
}

export interface ToolStats {
  totalSessions: number;
  totalToolCalls: number;
  byTool: Record<string, number>;
  bySession: Record<string, { count: number; tools: Record<string, number> }>;
  byDate: Record<string, { count: number; tools: Record<string, number> }>;
}

export type { ToolTabName };
type ToolTabName = "byTool" | "byDate" | "bySession";
