import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { GuardrailsGroup } from "../types";
import { findMatchingRules, type MatchedRule } from "./matching";

async function handleConfirmAction(
  matched: MatchedRule,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> {
  const { rule, group, targetValue } = matched;
  if (!ctx.hasUI)
    return { block: true, reason: `Blocked [${group.group}]: ${rule.reason}` };
  const icon = ctx.ui.theme ? ctx.ui.theme.fg("warning", "󰀪") : "󰀪";
  const proceed = await ctx.ui.confirm(
    `${icon} ${group.group}: ${rule.reason}`,
    targetValue,
  );
  if (!proceed)
    return { block: true, reason: "Blocked: User denied execution" };
  return undefined;
}

async function handleMatchedRule(
  matched: MatchedRule,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> {
  const { rule, group } = matched;

  if (rule.action === "block") {
    return { block: true, reason: `Blocked [${group.group}]: ${rule.reason}` };
  }
  if (rule.action === "confirm") {
    return handleConfirmAction(matched, ctx);
  }
  return undefined;
}

const EXCLUDED_TOOLS = new Set(["read", "genui"]);

async function evaluateMatchedRules(
  matchedRules: MatchedRule[],
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> {
  for (const matched of matchedRules) {
    const result = await handleMatchedRule(matched, ctx);
    if (result) return result;
  }
  return undefined;
}

export function setupPermissionGateHook(
  pi: ExtensionAPI,
  config: GuardrailsGroup[],
  isEnabled: () => boolean,
) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isEnabled()) return;
    if (EXCLUDED_TOOLS.has(event.toolName)) return;
    const matchedRules = await findMatchingRules(
      event.toolName,
      event.input,
      config,
      ctx.cwd,
    );
    return evaluateMatchedRules(matchedRules, ctx);
  });
}
