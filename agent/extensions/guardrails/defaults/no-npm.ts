import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "no-npm",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "* npm *",
        action: "block",
        reason:
          "npm is forbidden. Use Bun equivalents: `bun add`, `bun remove`, `bun run`, `bun install` (read skill: bun)",
      },
      {
        context: "command",
        pattern: "* npx *",
        action: "block",
        reason: "npx is forbidden. Use `bunx` instead (read skill: bun)",
      },
      {
        context: "command",
        pattern: "bun pm trust *",
        action: "block",
        reason:
          "modifies trusted package authors. This is a security-sensitive operation",
      },
    ],
  },
];

export default defaults;
