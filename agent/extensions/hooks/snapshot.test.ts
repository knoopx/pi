import { describe, it, expect } from "vitest";
import type { HooksGroup, HookRule } from "./schema";
import { renderGroupHeader, renderHookLine } from "./index";

function fg(_color: string, text: string): string {
  return text;
}

function formatHooksAudit(groups: HooksGroup[], allActive: boolean): string[] {
  const lines: string[] = [];

  for (const group of groups) {
    lines.push(renderGroupHeader(fg, group, allActive));

    for (const hook of group.hooks) {
      lines.push(renderHookLine(hook));
    }
  }

  return lines;
}

function makeHook(overrides: Partial<HookRule> = {}): HookRule {
  return {
    event: "tool_result",
    command: "echo test",
    ...overrides,
  };
}

function makeGroup(
  name: string,
  pattern: string,
  hooks: HookRule[],
): HooksGroup {
  return { group: name, pattern, hooks };
}

describe("hooks audit output", () => {
  it("renders audit output with active groups and hooks", () => {
    const groups: HooksGroup[] = [
      makeGroup("javascript", "*", [
        makeHook({
          context: "file_name",
          pattern: "*.{js,jsx,ts,tsx,json,css}",
          command: 'bunx prettier --write "%file%"',
          timeout: 5000,
        }),
      ]),
      makeGroup("typescript", "{tsconfig.json,tsconfig.*.json}", [
        makeHook({
          context: "file_name",
          pattern: "*.{ts,tsx,js,jsx}",
          command: 'bun run typecheck 2>&1 | { grep "%file%" || true; }',
          timeout: 60000,
          notify: true,
        }),
      ]),
      makeGroup("eslint", "eslint-config.*", [
        makeHook({
          command: 'bunx eslint "%file%"',
          timeout: 120000,
          notify: true,
        }),
      ]),
      makeGroup("shell", "*", [
        makeHook({
          context: "file_name",
          pattern: "*.{sh,bash}",
          command: 'shfmt -w "%file%"',
          timeout: 5000,
        }),
      ]),
      makeGroup("nu", "*", [
        makeHook({
          event: "tool_result",
          context: "file_name",
          pattern: "*.nu",
          command: 'nu --ide-check 10 "%file%"',
          timeout: 5000,
          notify: true,
        }),
      ]),
    ];

    const lines = formatHooksAudit(groups, true);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders audit output with active groups and hooks",
    );
  });

  it("renders single group with file_name context hook", () => {
    const groups: HooksGroup[] = [
      makeGroup("nix", "*", [
        makeHook({
          context: "file_name",
          pattern: "*.nix",
          command: 'alejandra -q "%file%"',
          timeout: 5000,
        }),
        makeHook({
          context: "file_name",
          pattern: "*.nix",
          command: 'nix-instantiate --parse "%file%"',
          timeout: 30000,
          notify: true,
        }),
      ]),
    ];

    const lines = formatHooksAudit(groups, true);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders single group with multiple hooks",
    );
  });

  it("renders mixed event types", () => {
    const groups: HooksGroup[] = [
      makeGroup("lifecycle", "*", [
        makeHook({ event: "session_start", command: "echo session started" }),
        makeHook({ event: "turn_end", command: "echo turn ended" }),
        makeHook({
          event: "tool_call",
          context: "command",
          pattern: "rm *",
          command: 'echo "dangerous command detected"',
        }),
      ]),
    ];

    const lines = formatHooksAudit(groups, true);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders mixed event types with context patterns",
    );
  });
});
