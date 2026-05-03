import { describe, it, expect } from "vitest";
import type { GuardrailsRule, GuardrailsGroup } from "./types";

function formatGuardrailsAudit(
  groups: GuardrailsGroup[],
  allActive: boolean,
): string[] {
  const lines: string[] = [];

  for (const group of groups) {
    const statusIcon = allActive ? "✓" : "✗";
    lines.push(`${statusIcon} ${group.group} (${group.pattern})`);

    for (const rule of group.rules) {
      const actionTag = rule.action === "block" ? "󰳛" : "󰀪";
      lines.push(`  ${actionTag} [${rule.context}] ${rule.pattern}`);
    }
  }

  return lines;
}

function makeRule(overrides: Partial<GuardrailsRule> = {}): GuardrailsRule {
  return {
    context: "command",
    pattern: "*",
    action: "block" as const,
    scope: undefined,
    reason: "test rule",
    ...overrides,
  };
}

function makeGroup(
  name: string,
  pattern: string,
  rules: GuardrailsRule[],
): GuardrailsGroup {
  return { group: name, pattern, rules };
}

describe("guardrails audit output", () => {
  it("renders audit output with active groups and rules", () => {
    const groups: GuardrailsGroup[] = [
      makeGroup("jj-not-git", "*.gitignore", [
        makeRule({ pattern: "git add" }),
        makeRule({ pattern: "git commit" }),
      ]),
      makeGroup("permission-gate", "*.{js,ts}", [
        makeRule({ pattern: "sudo *" }),
        makeRule({ pattern: "chmod 777" }),
      ]),
      makeGroup("interactive", "*.nix", [
        makeRule({ pattern: "node", action: "confirm" }),
        makeRule({ pattern: "python -i" }),
        makeRule({ pattern: "npm run dev" }),
      ]),
      makeGroup("lock-files", "*.lock", [
        makeRule({ context: "file_name", pattern: "*package-lock.json" }),
        makeRule({ context: "file_name", pattern: "*pnpm-lock.yaml" }),
        makeRule({ context: "file_name", pattern: "*yarn.lock" }),
      ]),
    ];

    const lines = formatGuardrailsAudit(groups, true);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders audit output with active groups and rules",
    );
  });

  it("renders single group with file_name context rules", () => {
    const groups: GuardrailsGroup[] = [
      makeGroup("testing", "*.{ts,tsx}", [
        makeRule({
          context: "file_content",
          pattern: "skip\\(true\\)",
        }),
        makeRule({
          context: "file_content",
          pattern: "\\.only\\(",
        }),
      ]),
    ];

    const lines = formatGuardrailsAudit(groups, true);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders single group with file_name context rules",
    );
  });

  it("renders mixed block and confirm actions", () => {
    const groups: GuardrailsGroup[] = [
      makeGroup("jj", "*.gitignore", [
        makeRule({ pattern: "jj restore" }),
        makeRule({ pattern: "jj git push", action: "confirm" }),
        makeRule({ pattern: "jj undo" }),
      ]),
    ];

    const lines = formatGuardrailsAudit(groups, true);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders mixed block and confirm actions",
    );
  });
});
