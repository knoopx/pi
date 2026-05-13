import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { GuardrailsGroup } from "../types";
import { findMatchingRules, type MatchedRule } from "./matching";

async function handleMatchedRule(
  matched: MatchedRule,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> {
  const { rule, group, targetValue } = matched;
  const { action, reason } = rule;

  if (action === "block")
    return { block: true, reason: `Blocked [${group.group}]: ${reason}` };

  if (action === "confirm") {
    if (!ctx.hasUI)
      return { block: true, reason: `Blocked [${group.group}]: ${reason}` };
    const icon = ctx.ui.theme ? ctx.ui.theme.fg("warning", "󰀪") : "󰀪";
    const proceed = await ctx.ui.confirm(
      `${icon} ${group.group}: ${reason}`,
      targetValue,
    );
    if (!proceed)
      return { block: true, reason: "Blocked: User denied execution" };
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
    const toolName = event.toolName;
    const input = event.input;

    if (toolName === "read" || toolName === "genui") return;
    const matchedRules = await findMatchingRules(
      toolName,
      input,
      config,
      ctx.cwd,
    );

    for (const matched of matchedRules) {
      const result = await handleMatchedRule(matched, ctx);
      if (result) return result;
    }

    return;
  });
}
