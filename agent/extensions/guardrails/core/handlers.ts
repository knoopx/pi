import type {
  ExtensionCommandContext,
  ThemeColor,
} from "@earendil-works/pi-coding-agent";
import type { GuardrailsGroup, GuardrailsRule } from "../types";
import { createThemeFg, notifyAuditResult } from "./audit";
import { configLoader } from "../config/loader";
import { isGroupActive } from "./checking";
import { matchCommandPattern } from "../../../shared/matching/command";
import { matchFileNamePattern } from "../../../shared/matching/pattern";

export function createGuardrailsHandler(
  ref: { value: boolean },
  _config: GuardrailsGroup[],
) {
  return async function handler(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const action = args.trim().toLowerCase();

    if (action === "on") {
      ref.value = true;
      const { saveGuardrailsSettings } = await import("../config/loader");
      await saveGuardrailsSettings({ enabled: true });
      ctx.ui?.notify("Guardrails enabled", "info");
      return;
    }

    if (action === "off") {
      ref.value = false;
      const { saveGuardrailsSettings } = await import("../config/loader");
      await saveGuardrailsSettings({ enabled: false });
      ctx.ui?.notify("Guardrails disabled", "warning");
      return;
    }

    await handleGuardrailsAudit(args, ctx);
  };
}

async function handleGuardrailsAudit(
  _args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const config = configLoader.getConfig();

  if (config.length === 0) {
    ctx.ui?.notify("No guardrails configured", "info");
    return;
  }
  const fg = createThemeFg(ctx.ui.theme);
  const auditResult = await auditGuardrailsConfig(config, ctx.cwd, fg);
  notifyAuditResult(ctx, auditResult, fg);
}

interface GuardrailsAuditResult {
  lines: string[];
  errors: number;
}

async function auditGuardrailsConfig(
  config: GuardrailsGroup[],
  cwd: string,
  fg: (color: ThemeColor, text: string) => string,
): Promise<GuardrailsAuditResult> {
  const lines: string[] = [];
  let errors = 0;

  for (const group of config) {
    const isActive = await isGroupActive(
      group.pattern,
      cwd,
      group.excludePattern,
    );
    const statusIcon = isActive ? "✓" : "✗";
    const statusColor = isActive ? "success" : "error";
    lines.push(
      `${fg(statusColor, statusIcon)} ${group.group} (${group.pattern})`,
    );

    for (let i = 0; i < group.rules.length; i++) {
      const rule = group.rules[i];
      const actionTag =
        rule.action === "block" ? fg("error", "󰳛") : fg("warning", "󰀪");
      lines.push(`  ${actionTag} [${rule.context}] ${rule.pattern}`);

      errors += validateGuardrailsRule(rule, i, fg, lines);
    }
  }

  return { lines, errors };
}

function validateGuardrailsRule(
  rule: GuardrailsRule,
  index: number,
  fg: (color: ThemeColor, text: string) => string,
  lines: string[],
): number {
  let errors = 0;

  if (
    (rule.context === "file_name" || rule.context === "file_content") &&
    rule.pattern
  ) {
    try {
      matchFileNamePattern("test", rule.pattern);
    } catch (e) {
      lines.push(
        `    ${fg("error", "✗")} invalid pattern at rules[${index}]: ${(e as Error).message}`,
      );
      errors++;
    }

    if (rule.file_pattern) {
      try {
        matchFileNamePattern("test", rule.file_pattern);
      } catch (e) {
        lines.push(
          `    ${fg("error", "✗")} invalid file_pattern at rules[${index}]: ${(e as Error).message}`,
        );
        errors++;
      }
    }
  }

  if (rule.context === "command") {
    try {
      matchCommandPattern("echo test", rule.pattern);
    } catch (e) {
      lines.push(
        `    ${fg("error", "✗")} invalid command pattern at rules[${index}]: ${(e as Error).message}`,
      );
      errors++;
    }
  }

  return errors;
}
