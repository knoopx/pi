import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "interactive",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "bun run dev *",
        action: "block",
        reason:
          "long-running server that blocks the terminal. Run in tmux instead (read skill: tmux)",
      },
      {
        context: "command",
        pattern: "vitest *",
        excludes: "* run *",
        action: "block",
        reason:
          "`vitest` without `run` starts watch mode. Use `bun vitest run` (read skill: vitest)",
      },
      {
        context: "command",
        pattern: "bun vitest *",
        excludes: "* run *",
        action: "block",
        reason:
          "`vitest` without `run` starts watch mode. Use `bun vitest run` (read skill: vitest)",
      },
      {
        context: "command",
        pattern: "tsc * {--watch,-w} *",
        action: "block",
        reason:
          "watch mode blocks the terminal. Use `tsc --noEmit` or run in tmux (read skill: tmux)",
      },
      {
        context: "command",
        pattern: "{bun,deno} repl *",
        action: "block",
        reason:
          "interactive REPL that blocks the terminal. Use `-e` flag to evaluate inline",
      },
    ],
  },
];

export default defaults;
