import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { HooksGroup, HookRule, HookOutput } from "../types/schema";
import type { HookResult } from "../types/results";
function groupHookResults(results: HookResult[]): Map<string, HookResult[]> {
  const grouped = new Map<string, HookResult[]>();
  for (const r of results) {
    const list = grouped.get(r.group) ?? [];
    list.push(r);
    grouped.set(r.group, list);
  }
  return grouped;
}
function getDisplayOutput(r: HookResult): string {
  return r.stderr ?? r.stdout ?? "";
}

function isSuppressed(r: HookResult): boolean {
  return r.output?.suppressOutput ?? false;
}

function shouldShowOutput(r: HookResult): boolean {
  if (r.success) return false;
  const displayOutput = getDisplayOutput(r);
  if (!displayOutput || isSuppressed(r)) return false;
  return !looksLikeJson(displayOutput);
}

function looksLikeJson(text: string): boolean {
  return text.trim().startsWith("{");
}
function formatResultIcon(r: HookResult): string {
  return r.success ? "✓" : "✗";
}

function appendOutputLines(lines: string[], r: HookResult): void {
  if (shouldShowOutput(r)) {
    const displayOutput = r.stderr || r.stdout;
    if (displayOutput) lines.push(displayOutput);
  }
}

function formatHookResult(r: HookResult): string[] {
  const lines: string[] = [];
  lines.push(`${formatResultIcon(r)} ${r.command}`);
  appendOutputLines(lines, r);
  return lines;
}
function sendHookResults(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  results: HookResult[],
): void {
  const grouped = groupHookResults(results);
  const lines: string[] = [];

  for (const [group, hooks] of grouped) {
    lines.push(`[${group}]`);
    for (const r of hooks) {
      lines.push(...formatHookResult(r));
    }
  }

  pi.sendMessage(
    { customType: "hook", content: lines.join("\n"), display: true },
    { triggerTurn: false },
  );
  ctx.ui.notify(`Hook results: ${results.length} result(s)`, "info");
}

function sendHookOutputs(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: { results: HookResult[]; additionalContexts: string[] },
): void {
  if (state.additionalContexts.length > 0) {
    pi.sendMessage(
      {
        customType: "hook-context",
        content: state.additionalContexts.join("\n\n"),
        display: true,
      },
      { triggerTurn: false },
    );
    ctx.ui.notify("Hook context injected", "info");
  }
  if (state.results.length > 0) sendHookResults(pi, ctx, state.results);
}
async function executeRules(
  config: HooksGroup[],
  ruleExecutor: (
    rule: HookRule,
    group: HooksGroup,
  ) => Promise<HookOutput | undefined>,
): Promise<boolean> {
  for (const group of config) {
    for (const rule of group.hooks) {
      const blockResult = await ruleExecutor(rule, group);
      if (blockResult !== undefined) return true;
    }
  }
  return false;
}

export async function processHookGroupExecution(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: { results: HookResult[]; additionalContexts: string[] },
  config: HooksGroup[],
  ruleExecutor: (
    rule: HookRule,
    group: HooksGroup,
  ) => Promise<HookOutput | undefined>,
): Promise<void> {
  const blocked = await executeRules(config, ruleExecutor);
  if (blocked) return;
  sendHookOutputs(pi, ctx, state);
}
