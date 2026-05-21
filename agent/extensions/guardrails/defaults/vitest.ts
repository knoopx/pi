import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "vitest",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "bun test *",
        action: "block",
        reason:
          "`bun test` invokes Bun's built-in test runner, not Vitest. Use `bun vitest run` instead (read skill: vitest)",
      },
    ],
  },
];

export default defaults;
