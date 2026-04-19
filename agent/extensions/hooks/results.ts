import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { HooksGroup, HookRule, HookOutput } from "./schema";
import { SKIP_TOOLS } from "./constants";

interface HookResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  output: HookOutput | undefined;
  group: string;
  command: string;
}

function groupHookResults(results: HookResult[]): Map<string, HookResult[]> {
  const grouped = new Map<string, HookResult[]>();
  for (const r of results) {
    const list = grouped.get(r.group) ?? [];
    list.push(r);
    grouped.set(r.group, list);
  }
  return grouped;
}

function shouldShowOutput(r: HookResult): boolean {
  if (r.success) return false;
  const displayOutput = r.stderr || r.stdout;
  if (!displayOutput || r.output?.suppressOutput) return false;
  const isJson = displayOutput.trim().startsWith("{");
  return !isJson;
}

function formatHookResult(r: HookResult): string[] {
  const lines: string[] = [];
  const icon = r.success ? "✓" : "✗";
  lines.push(`${icon} ${r.command}`);

  if (shouldShowOutput(r)) {
    const displayOutput = r.stderr || r.stdout;
    if (displayOutput) lines.push(displayOutput);
  }

  return lines;
}

function sendHookResults(pi: ExtensionAPI, results: HookResult[]): void {
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
}

export async function processHookGroupExecution(
  pi: ExtensionAPI,
  state: { results: HookResult[]; additionalContexts: string[] },
  config: HooksGroup[],
  ruleExecutor: (
    rule: HookRule,
    group: HooksGroup,
  ) => Promise<HookOutput | undefined>,
): Promise<void> {
  for (const group of config) {
    for (const rule of group.hooks) {
      const blockResult = await ruleExecutor(rule, group);
      if (blockResult !== undefined) return;
    }
  }

  if (state.additionalContexts.length > 0)
    pi.sendMessage(
      {
        customType: "hook-context",
        content: state.additionalContexts.join("\n\n"),
        display: false,
      },
      { triggerTurn: false },
    );

  if (state.results.length > 0) sendHookResults(pi, state.results);
}

export function getSkipTools(): ReadonlySet<string> {
  return SKIP_TOOLS;
}
