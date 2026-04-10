/**
 * Usage Statistics Extensions
 *
 * /usage - Usage statistics dashboard
 *   Shows an inline view with usage stats grouped by provider.
 *   - Tab cycles: Today → This Week → All Time
 *   - Arrow keys navigate providers
 *   - Enter expands/collapses to show models
 *
 * /tool-usage - Tool usage analysis
 *   Shows an inline view with tool usage stats from sessions.
 *   - Tab cycles: By Tool → By Date → By Session
 *   - Arrow keys navigate rows
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  Theme,
  FileEntry,
  SessionEntry,
} from "@mariozechner/pi-coding-agent";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import {
  CancellableLoader,
  Container,
  Spacer,
  matchesKey,
  visibleWidth,
  truncateToWidth,
} from "@mariozechner/pi-tui";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// =============================================================================
// Types
// =============================================================================

interface TokenStats {
  total: number;
  input: number;
  output: number;
  cache: number;
}

interface BaseStats {
  messages: number;
  cost: number;
  tokens: TokenStats;
}

interface ModelStats extends BaseStats {
  sessions: Set<string>;
}

interface ProviderStats extends BaseStats {
  sessions: Set<string>;
  models: Map<string, ModelStats>;
}

interface TotalStats extends BaseStats {
  sessions: number;
}

interface TimeFilteredStats {
  providers: Map<string, ProviderStats>;
  totals: TotalStats;
}

interface UsageData {
  today: TimeFilteredStats;
  thisWeek: TimeFilteredStats;
  allTime: TimeFilteredStats;
}

type TabName = "today" | "thisWeek" | "allTime";

// =============================================================================
// Input Handling Utilities
// =============================================================================

/**
 * Creates a key matcher function for input handling
 */
function createKeyMatcher(data: string) {
  const normalized = data.toLowerCase();
  return (key: Parameters<typeof matchesKey>[1]) =>
    matchesKey(data, key) || normalized === key;
}

/**
 * Handles escape/q key to close the component
 */
function handleEscape(
  matches: ReturnType<typeof createKeyMatcher>,
  done: () => void,
): boolean {
  if (matches("escape") || matches("q")) {
    done();
    return true;
  }
  return false;
}

// =============================================================================
// Column Configuration
// =============================================================================

interface DataColumn {
  label: string;
  width: number;
  dimmed?: boolean;
  getValue: (stats: BaseStats & { sessions: Set<string> | number }) => string;
}

const NAME_COL_WIDTH = 26;

const DATA_COLUMNS: DataColumn[] = [
  {
    label: "Sessions",
    width: 9,
    getValue: (s) =>
      formatNumber(
        typeof s.sessions === "number" ? s.sessions : s.sessions.size,
      ),
  },
  { label: "Msgs", width: 9, getValue: (s) => formatNumber(s.messages) },
  { label: "Cost", width: 9, getValue: (s) => formatCost(s.cost) },
  { label: "Tokens", width: 9, getValue: (s) => formatTokens(s.tokens.total) },
  {
    label: "↑In",
    width: 8,
    dimmed: true,
    getValue: (s) => formatTokens(s.tokens.input),
  },
  {
    label: "↓Out",
    width: 8,
    dimmed: true,
    getValue: (s) => formatTokens(s.tokens.output),
  },
  {
    label: "Cache",
    width: 8,
    dimmed: true,
    getValue: (s) => formatTokens(s.tokens.cache),
  },
];

const TABLE_WIDTH =
  NAME_COL_WIDTH + DATA_COLUMNS.reduce((sum, col) => sum + col.width, 0);

// =============================================================================
// Data Collection
// =============================================================================

function getSessionsDir(): string {
  // Replicate Pi's logic: respect PI_CODING_AGENT_DIR env var
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "sessions");
}

async function getAllSessionFiles(signal?: AbortSignal): Promise<string[]> {
  const sessionsDir = getSessionsDir();
  const files: string[] = [];

  try {
    const cwdDirs = await readdir(sessionsDir, { withFileTypes: true });
    for (const dir of cwdDirs) {
      if (signal?.aborted) return files;
      if (!dir.isDirectory()) continue;
      const cwdPath = join(sessionsDir, dir.name);
      try {
        const sessionFiles = await readdir(cwdPath);
        for (const file of sessionFiles) {
          if (file.endsWith(".jsonl")) {
            files.push(join(cwdPath, file));
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }
  } catch {
    // Return empty if we can't read sessions dir
  }

  return files;
}

interface SessionMessage {
  provider: string;
  model: string;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  timestamp: number;
}

function extractSessionIdFromEntry(entry: FileEntry): string | null {
  if (entry.type === "session" && typeof entry.id === "string") {
    return entry.id;
  }
  return null;
}

function validateEntry(
  entry: FileEntry,
): entry is Extract<SessionEntry, { type: "message" }> {
  return entry.type === "message";
}

function validateMessage(msg: unknown): msg is AssistantMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return (
    m.role === "assistant" &&
    typeof m.usage === "object" &&
    m.usage !== null &&
    typeof m.provider === "string" &&
    typeof m.model === "string"
  );
}

function extractMessageFromEntry(
  entry: FileEntry,
  seenHashes: Set<string>,
): SessionMessage | null {
  if (!validateEntry(entry)) return null;
  const msg = entry.message;
  if (!validateMessage(msg)) return null;

  const usage = msg.usage;
  const input = Number(usage.input) || 0;
  const output = Number(usage.output) || 0;
  const cacheRead = Number(usage.cacheRead) || 0;
  const cacheWrite = Number(usage.cacheWrite) || 0;
  const fallbackTs = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
  const timestamp =
    Number(msg.timestamp) || (Number.isNaN(fallbackTs) ? 0 : fallbackTs);

  const totalTokens = input + output + cacheRead + cacheWrite;
  const hash = `${timestamp}:${totalTokens}`;
  if (seenHashes.has(hash)) return null;
  seenHashes.add(hash);

  return {
    provider: msg.provider,
    model: msg.model,
    cost: usage.cost.total || 0,
    input,
    output,
    cacheRead,
    cacheWrite,
    timestamp,
  };
}

async function parseSessionFile(
  filePath: string,
  seenHashes: Set<string>,
  signal?: AbortSignal,
): Promise<{ sessionId: string; messages: SessionMessage[] } | null> {
  try {
    const content = await readFile(filePath, "utf8");
    if (checkSignalAborted(signal)) return null;
    const lines = content.trim().split("\n");
    const messages: SessionMessage[] = [];
    let sessionId = "";

    for (let i = 0; i < lines.length; i++) {
      if (checkSignalAborted(signal)) return null;
      if (i % 500 === 0) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      const result = await parseSessionLine(lines[i], seenHashes);
      if (result.sessionId) sessionId = result.sessionId;
      if (result.message) messages.push(result.message);
    }

    return sessionId ? { sessionId, messages } : null;
  } catch {
    return null;
  }
}

async function parseSessionLine(
  line: string,
  seenHashes: Set<string>,
): Promise<{ sessionId?: string; message?: SessionMessage }> {
  if (!line.trim()) return {};
  try {
    const entry = JSON.parse(line);
    const extractedSessionId = extractSessionIdFromEntry(entry);
    if (extractedSessionId) return { sessionId: extractedSessionId };
    const message = extractMessageFromEntry(entry, seenHashes);
    if (message) return { message };
  } catch {
    // Skip malformed lines
  }
  return {};
}

// Helper to accumulate stats into a target
function accumulateStats(
  target: BaseStats,
  cost: number,
  tokens: { total: number; input: number; output: number; cache: number },
): void {
  target.messages++;
  target.cost += cost;
  target.tokens.total += tokens.total;
  target.tokens.input += tokens.input;
  target.tokens.output += tokens.output;
  target.tokens.cache += tokens.cache;
}

function emptyTokens(): TokenStats {
  return { total: 0, input: 0, output: 0, cache: 0 };
}

function emptyModelStats(): ModelStats {
  return { sessions: new Set(), messages: 0, cost: 0, tokens: emptyTokens() };
}

function emptyProviderStats(): ProviderStats {
  return {
    sessions: new Set(),
    messages: 0,
    cost: 0,
    tokens: emptyTokens(),
    models: new Map(),
  };
}

function emptyTimeFilteredStats(): TimeFilteredStats {
  return {
    providers: new Map(),
    totals: { sessions: 0, messages: 0, cost: 0, tokens: emptyTokens() },
  };
}

function checkSignalAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function getTimePeriods(
  timestamp: number,
  todayMs: number,
  weekStartMs: number,
): TabName[] {
  const periods: TabName[] = ["allTime"];
  if (timestamp >= todayMs) periods.push("today");
  if (timestamp >= weekStartMs) periods.push("thisWeek");
  return periods;
}

function processMessage(
  msg: SessionMessage,
  sessionId: string,
  data: UsageData,
  todayMs: number,
  weekStartMs: number,
): { today: boolean; thisWeek: boolean; allTime: boolean } {
  const periods = getTimePeriods(msg.timestamp, todayMs, weekStartMs);
  const tokens = {
    total: msg.input + msg.output,
    input: msg.input,
    output: msg.output,
    cache: msg.cacheRead + msg.cacheWrite,
  };
  const sessionContributed = { today: false, thisWeek: false, allTime: false };

  for (const period of periods) {
    const stats = data[period];
    let providerStats = stats.providers.get(msg.provider);
    if (!providerStats) {
      providerStats = emptyProviderStats();
      stats.providers.set(msg.provider, providerStats);
    }
    let modelStats = providerStats.models.get(msg.model);
    if (!modelStats) {
      modelStats = emptyModelStats();
      providerStats.models.set(msg.model, modelStats);
    }
    modelStats.sessions.add(sessionId);
    accumulateStats(modelStats, msg.cost, tokens);
    providerStats.sessions.add(sessionId);
    accumulateStats(providerStats, msg.cost, tokens);
    accumulateStats(stats.totals, msg.cost, tokens);
    sessionContributed[period] = true;
  }
  return sessionContributed;
}

function calculateTimeBoundaries(): { todayMs: number; weekStartMs: number } {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const startOfWeek = new Date();
  const dayOfWeek = startOfWeek.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const weekStartMs = startOfWeek.getTime();

  return { todayMs, weekStartMs };
}

function createEmptyUsageData(): UsageData {
  return {
    today: emptyTimeFilteredStats(),
    thisWeek: emptyTimeFilteredStats(),
    allTime: emptyTimeFilteredStats(),
  };
}

async function processSessionFile(
  filePath: string,
  seenHashes: Set<string>,
  data: UsageData,
  todayMs: number,
  weekStartMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (checkSignalAborted(signal)) return;
  const parsed = await parseSessionFile(filePath, seenHashes, signal);
  if (checkSignalAborted(signal)) return;
  if (!parsed) return;

  const { sessionId, messages } = parsed;
  const sessionContributed = {
    today: false,
    thisWeek: false,
    allTime: false,
  };

  for (const msg of messages) {
    if (checkSignalAborted(signal)) return;
    const contributed = processMessage(
      msg,
      sessionId,
      data,
      todayMs,
      weekStartMs,
    );
    if (contributed.today) sessionContributed.today = true;
    if (contributed.thisWeek) sessionContributed.thisWeek = true;
    if (contributed.allTime) sessionContributed.allTime = true;
  }

  if (sessionContributed.today) data.today.totals.sessions++;
  if (sessionContributed.thisWeek) data.thisWeek.totals.sessions++;
  if (sessionContributed.allTime) data.allTime.totals.sessions++;
}

async function collectUsageData(
  signal?: AbortSignal,
): Promise<UsageData | null> {
  const { todayMs, weekStartMs } = calculateTimeBoundaries();
  const data = createEmptyUsageData();

  const sessionFiles = await getAllSessionFiles(signal);
  if (checkSignalAborted(signal)) return null;
  const seenHashes = new Set<string>();

  for (const filePath of sessionFiles) {
    await processSessionFile(
      filePath,
      seenHashes,
      data,
      todayMs,
      weekStartMs,
      signal,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return data;
}

// =============================================================================
// Formatting Helpers
// =============================================================================

function formatCost(cost: number): string {
  if (cost === 0) return "-";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  if (cost < 10) return `$${cost.toFixed(2)}`;
  if (cost < 100) {
    const truncated = Math.floor(cost * 10) / 10;
    return `$${truncated.toFixed(1)}`;
  }
  return `$${Math.round(cost)}`;
}

function formatTokens(count: number): string {
  if (count === 0) return "-";
  if (count < 1000) return count.toString();
  if (count < 10000) {
    const truncated = Math.floor(count / 100) / 10;
    return `${truncated.toFixed(1)}k`;
  }
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count < 1000000000) return `${Math.round(count / 1000000)}M`;
  if (count < 10000000000) return `${(count / 1000000000).toFixed(1)}B`;
  return `${Math.round(count / 1000000000)}B`;
}

function formatNumber(n: number): string {
  if (n === 0) return "-";
  return new Intl.NumberFormat("en-US").format(n);
}

function padLeft(s: string, len: number): string {
  const vis = visibleWidth(s);
  if (vis >= len) return s;
  return " ".repeat(len - vis) + s;
}

function padRight(s: string, len: number): string {
  const vis = visibleWidth(s);
  if (vis >= len) return s;
  return s + " ".repeat(len - vis);
}

// =============================================================================
// Component
// =============================================================================

const TAB_LABELS: Record<TabName, string> = {
  today: "Today",
  thisWeek: "This Week",
  allTime: "All Time",
};

const TAB_ORDER: TabName[] = ["today", "thisWeek", "allTime"];

/**
 * Helper to handle common key bindings for usage components
 */
function handleUsageInput(
  data: string,
  done: () => void,
  onTabForward: () => void,
  onTabBackward: () => void,
  onUp: () => void,
  onDown: () => void,
  onEnter?: () => void,
): void {
  const matches = createKeyMatcher(data);

  if (handleEscape(matches, done)) return;

  if (matches("tab") || matches("right")) {
    onTabForward();
  } else if (matches("shift+tab") || matches("left")) {
    onTabBackward();
  } else if (matches("up")) {
    onUp();
  } else if (matches("down")) {
    onDown();
  } else if (onEnter && (matches("enter") || matches("space"))) {
    onEnter();
  }
}

class UsageComponent {
  activeTab: TabName = "today";
  private data: UsageData;
  selectedIndex = 0;
  expanded = new Set<string>();
  providerOrder: string[] = [];
  private theme: Theme;
  private requestRender: () => void;
  private done: () => void;

  constructor(
    theme: Theme,
    data: UsageData,
    requestRender: () => void,
    done: () => void,
  ) {
    this.theme = theme;
    this.requestRender = requestRender;
    this.done = done;
    this.data = data;
    this.updateProviderOrder();
  }

  private updateProviderOrder(): void {
    const stats = this.data[this.activeTab];
    // Filter out providers with zero usage data (all sessions, messages, and tokens must be > 0)
    const providersWithUsage = Array.from(stats.providers.entries())
      .filter(([_, stats]) => {
        const sessionCount =
          typeof stats.sessions === "number"
            ? stats.sessions
            : stats.sessions.size;
        // A provider is only shown if it has genuine usage data across all metrics
        return sessionCount > 0 && stats.messages > 0 && stats.tokens.total > 0;
      })
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([name]) => name);
    this.providerOrder = providersWithUsage;
    this.selectedIndex = Math.min(
      this.selectedIndex,
      Math.max(0, this.providerOrder.length - 1),
    );
  }

  handleInput(data: string): void {
    handleUsageInput(
      data,
      this.done,
      () => this.cycleTab(1),
      () => this.cycleTab(-1),
      () => this.navigateSelection(-1),
      () => this.navigateSelection(1),
      () => this.toggleProvider(),
    );
  }

  cycleTab(direction: number): void {
    const idx = TAB_ORDER.indexOf(this.activeTab);
    this.activeTab =
      TAB_ORDER[(idx + direction + TAB_ORDER.length) % TAB_ORDER.length]!;
    this.updateProviderOrder();
    this.requestRender();
  }

  navigateSelection(direction: number): void {
    const newIdx = this.selectedIndex + direction;
    if (newIdx < 0 || newIdx >= this.providerOrder.length) return;
    this.selectedIndex = newIdx;
    this.requestRender();
  }

  toggleProvider(): void {
    const provider = this.providerOrder[this.selectedIndex];
    if (!provider) return;
    if (this.expanded.has(provider)) {
      this.expanded.delete(provider);
    } else {
      this.expanded.add(provider);
    }
    this.requestRender();
  }

  // -------------------------------------------------------------------------
  // Render Methods
  // -------------------------------------------------------------------------

  render(): string[] {
    return [
      ...this.renderTitle(),
      ...this.renderTabs(),
      ...this.renderHeader(),
      ...this.renderRows(),
      ...this.renderTotals(),
      ...this.renderHelp(),
    ];
  }

  private renderTitle(): string[] {
    const th = this.theme;
    return [th.fg("accent", th.bold("Usage Statistics")), ""];
  }

  private renderTabs(): string[] {
    const th = this.theme;
    const tabs = TAB_ORDER.map((tab) => {
      const label = TAB_LABELS[tab];
      return tab === this.activeTab
        ? th.fg("accent", `[${label}]`)
        : th.fg("dim", ` ${label} `);
    }).join("  ");
    return [tabs, ""];
  }

  private renderHeader(): string[] {
    const th = this.theme;

    let headerLine = padRight("Provider / Model", NAME_COL_WIDTH);
    for (const col of DATA_COLUMNS) {
      const label = padLeft(col.label, col.width);
      headerLine += col.dimmed ? th.fg("dim", label) : label;
    }

    return [
      th.fg("muted", headerLine),
      th.fg("border", "─".repeat(TABLE_WIDTH)),
    ];
  }

  private renderDataRow(
    name: string,
    stats: BaseStats & { sessions: Set<string> | number },
    options: { indent?: number; selected?: boolean; dimAll?: boolean } = {},
  ): string {
    const th = this.theme;
    const { indent = 0, selected = false, dimAll = false } = options;

    const indentStr = " ".repeat(indent);
    const nameWidth = NAME_COL_WIDTH - indent;
    const truncName = truncateToWidth(name, nameWidth - 1);
    const styledName = selected
      ? th.fg("accent", truncName)
      : dimAll
        ? th.fg("dim", truncName)
        : truncName;

    let row = indentStr + padRight(styledName, nameWidth);

    for (const col of DATA_COLUMNS) {
      const value = col.getValue(stats);
      const shouldDim = col.dimmed || dimAll;
      row += shouldDim
        ? th.fg("dim", padLeft(value, col.width))
        : padLeft(value, col.width);
    }

    return row;
  }

  private renderRows(): string[] {
    const th = this.theme;
    const stats = this.data[this.activeTab];
    const lines: string[] = [];

    if (this.providerOrder.length === 0) {
      lines.push(th.fg("dim", "  No usage data for this period"));
      return lines;
    }

    for (let i = 0; i < this.providerOrder.length; i++) {
      const providerName = this.providerOrder[i];
      const providerStats = stats.providers.get(providerName)!;
      const isSelected = i === this.selectedIndex;
      const isExpanded = this.expanded.has(providerName);

      // Provider row with expand/collapse arrow
      const arrow = isExpanded ? "▾" : "▸";
      const prefix = isSelected
        ? th.fg("accent", arrow + " ")
        : th.fg("dim", arrow + " ");
      const dataRow = this.renderDataRow(providerName, providerStats, {
        indent: 2,
        selected: isSelected,
      });
      lines.push(prefix + dataRow.slice(2)); // Replace indent with arrow prefix

      // Model rows (if expanded)
      if (isExpanded) {
        const models = Array.from(providerStats.models.entries()).sort(
          (a, b) => b[1].cost - a[1].cost,
        );

        for (const [modelName, modelStats] of models) {
          lines.push(
            this.renderDataRow(modelName, modelStats, {
              indent: 4,
              dimAll: true,
            }),
          );
        }
      }
    }

    return lines;
  }

  private renderTotals(): string[] {
    const th = this.theme;
    const stats = this.data[this.activeTab];

    let totalRow = padRight(th.bold("Total"), NAME_COL_WIDTH);
    for (const col of DATA_COLUMNS) {
      const value = col.getValue(stats.totals);
      totalRow += col.dimmed
        ? th.fg("dim", padLeft(value, col.width))
        : padLeft(value, col.width);
    }

    return [th.fg("border", "─".repeat(TABLE_WIDTH)), totalRow, ""];
  }

  private renderHelp(): string[] {
    return [
      this.theme.fg(
        "dim",
        "[Tab/←→] period  [↑↓] select  [Enter] expand  [q] close",
      ),
    ];
  }

  invalidate(): void {}
  dispose(): void {}
}

// =============================================================================
// Tool Usage Analysis
// =============================================================================

interface ToolCall {
  name: string;
  sessionId: string;
  timestamp: string;
}

interface ToolStats {
  totalSessions: number;
  totalToolCalls: number;
  byTool: Record<string, number>;
  bySession: Record<string, { count: number; tools: Record<string, number> }>;
  byDate: Record<string, { count: number; tools: Record<string, number> }>;
}

async function findToolSessionFiles(
  sessionsDir: string,
): Promise<{ dir: string; file: string }[]> {
  const results: { dir: string; file: string }[] = [];
  try {
    const sessionDirs = await readdir(sessionsDir);
    for (const dir of sessionDirs) {
      if (dir === "subagents") continue;
      const dirPath = join(sessionsDir, dir);
      try {
        const files = await readdir(dirPath);
        for (const file of files) {
          if (file.endsWith(".jsonl")) {
            results.push({ dir, file: join(dirPath, file) });
          }
        }
      } catch {
        // Skip non-directories
      }
    }
  } catch {
    // Return empty if we can't read sessions dir
  }
  return results;
}

function parseSessionEntry(
  line: string,
  sessionId: string | null,
): { sessionId: string | null; toolCalls: ToolCall[] } {
  if (!line.trim()) return { sessionId, toolCalls: [] };
  try {
    const entry = JSON.parse(line);
    if (entry.type === "session" && entry.id) {
      return { sessionId: entry.id, toolCalls: [] };
    }
    if (entry.type === "message" && entry.message?.content && sessionId) {
      const contents = Array.isArray(entry.message.content)
        ? entry.message.content
        : [entry.message.content];
      const toolCalls: ToolCall[] = [];
      for (const content of contents) {
        if (content?.type === "toolCall" && content.name) {
          toolCalls.push({
            name: content.name,
            sessionId,
            timestamp: entry.timestamp,
          });
        }
      }
      return { sessionId, toolCalls };
    }
  } catch {
    // Skip malformed lines
  }
  return { sessionId, toolCalls: [] };
}

async function parseToolSession(
  filePath: string,
): Promise<{ sessionId: string | null; toolCalls: ToolCall[] }> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.trim().split("\n");
  let sessionId: string | null = null;
  const toolCalls: ToolCall[] = [];

  for (const line of lines) {
    const result = parseSessionEntry(line, sessionId);
    sessionId = result.sessionId;
    toolCalls.push(...result.toolCalls);
  }
  return { sessionId, toolCalls };
}

function aggregateToolStats(
  allToolCalls: ToolCall[],
  sessionCount: number,
): ToolStats {
  const stats: ToolStats = {
    totalSessions: sessionCount,
    totalToolCalls: allToolCalls.length,
    byTool: {},
    bySession: {},
    byDate: {},
  };

  for (const call of allToolCalls) {
    stats.byTool[call.name] = (stats.byTool[call.name] || 0) + 1;

    if (!stats.bySession[call.sessionId]) {
      stats.bySession[call.sessionId] = { count: 0, tools: {} };
    }
    stats.bySession[call.sessionId].count++;
    stats.bySession[call.sessionId].tools[call.name] =
      (stats.bySession[call.sessionId].tools[call.name] || 0) + 1;

    const date = call.timestamp?.split("T")[0] || "unknown";
    if (!stats.byDate[date]) {
      stats.byDate[date] = { count: 0, tools: {} };
    }
    stats.byDate[date].count++;
    stats.byDate[date].tools[call.name] =
      (stats.byDate[date].tools[call.name] || 0) + 1;
  }

  return stats;
}

type ToolTabName = "byTool" | "byDate" | "bySession";

const TOOL_TAB_LABELS: Record<ToolTabName, string> = {
  byTool: "By Tool",
  byDate: "By Date",
  bySession: "By Session",
};

const TOOL_TAB_ORDER: ToolTabName[] = ["byTool", "byDate", "bySession"];

class ToolUsageComponent {
  private activeTab: ToolTabName = "byTool";
  private data: ToolStats;
  private selectedIndex = 0;
  private theme: Theme;
  private requestRender: () => void;
  private done: () => void;

  constructor(
    theme: Theme,
    data: ToolStats,
    requestRender: () => void,
    done: () => void,
  ) {
    this.theme = theme;
    this.data = data;
    this.requestRender = requestRender;
    this.done = done;
  }

  private getRowCount(): number {
    switch (this.activeTab) {
      case "byTool":
        return Math.min(Object.keys(this.data.byTool).length, 20);
      case "byDate":
        return Object.keys(this.data.byDate).length;
      case "bySession":
        return Math.min(Object.keys(this.data.bySession).length, 20);
      default:
        return 0;
    }
  }

  handleInput(data: string): void {
    handleUsageInput(
      data,
      this.done,
      () => this.cycleToolTab(1),
      () => this.cycleToolTab(-1),
      () => {
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
          this.requestRender();
        }
      },
      () => {
        const maxIdx = this.getRowCount() - 1;
        if (this.selectedIndex < maxIdx) {
          this.selectedIndex++;
          this.requestRender();
        }
      },
    );
  }

  private cycleToolTab(direction: number): void {
    const idx = TOOL_TAB_ORDER.indexOf(this.activeTab);
    this.activeTab =
      TOOL_TAB_ORDER[
        (idx + direction + TOOL_TAB_ORDER.length) % TOOL_TAB_ORDER.length
      ]!;
    this.selectedIndex = 0;
    this.requestRender();
  }

  render(): string[] {
    return [
      ...this.renderTitle(),
      ...this.renderTabs(),
      ...this.renderContent(),
      ...this.renderInsights(),
      ...this.renderHelp(),
    ];
  }

  private renderTitle(): string[] {
    const th = this.theme;
    return [
      th.fg("accent", th.bold("Tool Usage Statistics")),
      "",
      `Sessions: ${formatNumber(this.data.totalSessions)}  |  Tool Calls: ${formatNumber(this.data.totalToolCalls)}`,
      "",
    ];
  }

  private renderTabs(): string[] {
    const th = this.theme;
    const tabs = TOOL_TAB_ORDER.map((tab) => {
      const label = TOOL_TAB_LABELS[tab];
      return tab === this.activeTab
        ? th.fg("accent", `[${label}]`)
        : th.fg("dim", ` ${label} `);
    }).join("  ");
    return [tabs, ""];
  }

  private renderContent(): string[] {
    switch (this.activeTab) {
      case "byTool":
        return this.renderByTool();
      case "byDate":
        return this.renderByDate();
      case "bySession":
        return this.renderBySession();
      default:
        return [];
    }
  }

  private renderByTool(): string[] {
    const th = this.theme;
    const lines: string[] = [];
    const sortedTools = Object.entries(this.data.byTool)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    if (sortedTools.length === 0) {
      lines.push(th.fg("dim", "  No tool usage data"));
      return lines;
    }

    const maxNameLen = Math.max(
      ...sortedTools.map(([name]) => name.length),
      10,
    );
    const maxCount = sortedTools[0]?.[1] || 0;
    const barWidth = 30;

    for (let i = 0; i < sortedTools.length; i++) {
      const [name, count] = sortedTools[i];
      const pct = ((count / this.data.totalToolCalls) * 100).toFixed(1);
      const barLen = Math.round((count / maxCount) * barWidth);
      const bar = "█".repeat(barLen);
      const isSelected = i === this.selectedIndex;

      const nameStr = isSelected
        ? th.fg("accent", name.padEnd(maxNameLen))
        : name.padEnd(maxNameLen);
      const countStr = String(count).padStart(6);
      const pctStr = `(${pct.padStart(5)}%)`;

      lines.push(
        `  ${nameStr}  ${countStr}  ${th.fg("dim", pctStr)}  ${th.fg("accent", bar)}`,
      );
    }

    return [...lines, ""];
  }

  private renderByDate(): string[] {
    const th = this.theme;
    const lines: string[] = [];
    const sortedDates = Object.entries(this.data.byDate).sort(([a], [b]) =>
      b.localeCompare(a),
    ); // Most recent first

    if (sortedDates.length === 0) {
      lines.push(th.fg("dim", "  No date data"));
      return lines;
    }

    for (let i = 0; i < sortedDates.length; i++) {
      const [date, data] = sortedDates[i];
      const topTools = Object.entries(data.tools)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([t, c]) => `${t}(${c})`)
        .join(", ");

      const isSelected = i === this.selectedIndex;
      const dateStr = isSelected ? th.fg("accent", date) : date;
      const countStr = String(data.count).padStart(5);

      lines.push(
        `  ${dateStr}  ${countStr} calls  → ${th.fg("dim", topTools)}`,
      );
    }

    return [...lines, ""];
  }

  private renderBySession(): string[] {
    const th = this.theme;
    const lines: string[] = [];
    const sortedSessions = Object.entries(this.data.bySession)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20);

    if (sortedSessions.length === 0) {
      lines.push(th.fg("dim", "  No session data"));
      return lines;
    }

    for (let i = 0; i < sortedSessions.length; i++) {
      const [session, data] = sortedSessions[i];
      const shortName = truncateToWidth(
        session.replace(/--/g, "/").replace(/^\//, ""),
        40,
      );
      const topTools = Object.entries(data.tools)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([t, c]) => `${t}(${c})`)
        .join(", ");

      const isSelected = i === this.selectedIndex;
      const nameStr = isSelected
        ? th.fg("accent", padRight(shortName, 42))
        : padRight(shortName, 42);
      const countStr = String(data.count).padStart(5);

      lines.push(`  ${nameStr} ${countStr} → ${th.fg("dim", topTools)}`);
    }

    return [...lines, ""];
  }

  private renderInsights(): string[] {
    const th = this.theme;
    const lines: string[] = [th.fg("border", "─".repeat(70)), ""];

    const sortedTools = Object.entries(this.data.byTool).sort(
      ([, a], [, b]) => b - a,
    );
    const topTool = sortedTools[0];
    if (topTool) {
      const pct = ((topTool[1] / this.data.totalToolCalls) * 100).toFixed(1);
      lines.push(
        `  Most used: ${th.fg("accent", topTool[0])} (${topTool[1]} calls, ${pct}%)`,
      );
    }

    const avgPerSession = (
      this.data.totalToolCalls / this.data.totalSessions
    ).toFixed(1);
    lines.push(
      `  Avg per session: ${avgPerSession}  |  Unique tools: ${Object.keys(this.data.byTool).length}`,
    );

    return [...lines, ""];
  }

  private renderHelp(): string[] {
    return [this.theme.fg("dim", "[Tab/←→] view  [↑↓] select  [q] close")];
  }

  invalidate(): void {}
  dispose(): void {}
}

/**
 * Create a bordered custom UI component with consistent layout
 */
function createBorderedCustomUI<
  T extends {
    render(): string[];
    handleInput(input: string): void;
  },
>(
  tui: unknown,
  theme: {
    fg(c: string, s: string): string;
  },
  done: () => void,
  createComponent: () => T,
): {
  render: (w: number) => string[];
  invalidate: () => void;
  handleInput: (input: string) => void;
  dispose: () => void;
} {
  const container = new Container();
  container.addChild(new Spacer(1));
  container.addChild(new DynamicBorder((s: string) => theme.fg("border", s)));
  container.addChild(new Spacer(1));

  const component = createComponent();

  return {
    render: (w: number) => {
      const borderLines = container.render(w);
      const componentLines = component.render();
      const bottomBorder = theme.fg("border", "─".repeat(w));
      return [...borderLines, ...componentLines, "", bottomBorder];
    },
    invalidate: () => {
      container.invalidate();
    },
    handleInput: (input: string) => {
      component.handleInput(input);
    },
    dispose: () => {},
  };
}

// =============================================================================
// Extension Entry Point
// =============================================================================

export {
  getSessionsDir,
  UsageComponent,
  formatCost,
  formatTokens,
  formatNumber,
  padLeft,
  padRight,
  type UsageData,
};

/**
 * Load data with a cancellable loader and display it in a bordered UI
 */
async function loadAndDisplay<
  TData,
  TComponent extends {
    render(): string[];
    handleInput(input: string): void;
  },
>(
  ctx: ExtensionCommandContext,
  loaderMessage: string,
  collectData: (signal: AbortSignal) => Promise<TData | null>,
  createComponent: (theme: Theme, data: TData) => TComponent,
): Promise<void> {
  if (!ctx.hasUI) {
    return;
  }

  const data = await ctx.ui.custom<TData | null>(
    (tui, theme, keybindings, done) => {
      const loader = new CancellableLoader(
        tui,
        (s: string) => theme.fg("accent", s),
        (s: string) => theme.fg("muted", s),
        loaderMessage,
      );
      let finished = false;
      const finish = (value: TData | null) => {
        if (finished) return;
        finished = true;
        loader.dispose();
        done(value);
      };

      loader.onAbort = () => {
        finish(null);
      };

      collectData(loader.signal)
        .then(finish)
        .catch(() => {
          finish(null);
        });

      return loader;
    },
  );

  if (!data) {
    return;
  }

  await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
    return createBorderedCustomUI(tui, theme, done, () =>
      createComponent(theme, data),
    );
  });
}

async function collectToolStats(
  signal?: AbortSignal,
): Promise<ToolStats | null> {
  const sessionsDir = getSessionsDir();
  const sessionFiles = await findToolSessionFiles(sessionsDir);
  if (signal?.aborted) return null;

  const allToolCalls: ToolCall[] = [];
  let sessionCount = 0;

  for (const { file } of sessionFiles) {
    if (signal?.aborted) return null;
    try {
      const { sessionId, toolCalls } = await parseToolSession(file);
      if (sessionId) sessionCount++;
      allToolCalls.push(...toolCalls);
    } catch {
      // Skip files that can't be parsed
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return aggregateToolStats(allToolCalls, sessionCount);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("tool-usage", {
    description: "Show tool usage statistics dashboard",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await loadAndDisplay(
        ctx,
        "Loading Tool Usage...",
        collectToolStats,
        (theme, data) =>
          new ToolUsageComponent(
            theme,
            data,
            () => {},
            () => {},
          ),
      );
    },
  });

  pi.registerCommand("usage", {
    description: "Show usage statistics dashboard",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await loadAndDisplay(
        ctx,
        "Loading Usage...",
        collectUsageData,
        (theme, data) =>
          new UsageComponent(
            theme,
            data,
            () => {},
            () => {},
          ),
      );
    },
  });
}
