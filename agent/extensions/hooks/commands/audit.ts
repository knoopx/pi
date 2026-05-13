import type {
  ExtensionCommandContext,
  ThemeColor,
} from "@earendil-works/pi-coding-agent";
import { createThemeFg, notifyAuditResult } from "../../guardrails/core/audit";
import { configLoader } from "../config/loader";
import { isGroupActive } from "../engine/matching";
import { matchCommandPattern } from "../../../shared/matching/command";
import { matchFileNamePattern } from "../../../shared/matching/pattern";

interface AuditResult {
  lines: string[];
  errors: number;
}

export function renderGroupHeader(
  fg: (color: ThemeColor, text: string) => string,
  group: { group: string; pattern: string },
  isActive: boolean,
): string {
  const statusIcon = isActive ? "✓" : "✗";
  const statusColor = isActive ? "success" : "error";
  return `${fg(statusColor, statusIcon)} ${group.group} (${group.pattern})`;
}

export function renderHookLine(hook: {
  event: string;
  context?: string;
  pattern?: string;
  command: string;
}): string {
  const context = hook.context ? ` [${hook.context}: ${hook.pattern}]` : "";
  return `  → ${hook.event}${context}: ${hook.command}`;
}

interface PatternValidationCtx {
  index: number;
  fg: (color: ThemeColor, text: string) => string;
  lines: string[];
}

function validateHookPattern(
  hook: NonNullable<
    ReturnType<typeof configLoader.getConfig>
  >[number]["hooks"][number],
  ctx: PatternValidationCtx,
): number {
  if (!hook.context || !hook.pattern) return 0;
  return validatePatternWithContext(hook.context, hook.pattern, ctx);
}

function validatePatternWithContext(
  context: string,
  pattern: string,
  ctx: PatternValidationCtx,
): number {
  const matcher = buildPatternMatcher(context, pattern);
  if (!tryValidate(matcher, "test", ctx)) {
    return 1;
  }
  if (context === "command") {
    return tryValidate(matcher, "echo test", ctx) ? 0 : 1;
  }
  return 0;
}

function buildPatternMatcher(
  context: string,
  pattern: string,
): (input: string) => void {
  if (context === "file_name") {
    return (input: string) => matchFileNamePattern(input, pattern);
  }
  return (input: string) => matchCommandPattern(input, pattern);
}

function tryValidate(
  matcher: (input: string) => void,
  input: string,
  ctx: PatternValidationCtx,
): boolean {
  try {
    matcher(input);
    return true;
  } catch (e) {
    ctx.lines.push(
      `    ${ctx.fg("error", "✗")} invalid pattern at hooks[${ctx.index}]: ${(e as Error).message}`,
    );
    return false;
  }
}

async function auditHooksConfig(
  config: ReturnType<typeof configLoader.getConfig>,
  cwd: string,
  fg: (color: ThemeColor, text: string) => string,
): Promise<AuditResult> {
  const lines: string[] = [];
  let errors = 0;

  for (const group of config) {
    const isActive = await isGroupActive(group.pattern, cwd);
    lines.push(renderGroupHeader(fg, group, isActive));

    for (let i = 0; i < group.hooks.length; i++) {
      const hook = group.hooks[i];
      lines.push(renderHookLine(hook));
      errors += validateHookPattern(hook, { index: i, fg, lines });
    }
  }

  return { lines, errors };
}

export async function handleHooksAudit(
  _args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const config = configLoader.getConfig();

  if (config.length === 0) {
    ctx.ui?.notify("No hooks configured", "info");
    return;
  }
  const fg = createThemeFg(ctx.ui.theme);
  const auditResult = await auditHooksConfig(config, ctx.cwd, fg);
  notifyAuditResult(ctx, auditResult, fg);
}
