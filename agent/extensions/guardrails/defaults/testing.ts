import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "testing",
    pattern: "*.test.ts",
    rules: [
      {
        context: "file_content",
        file_pattern: "*.{js,jsx,ts,tsx,mjs,cjs}",
        pattern: ".skip(|describe.skip|xdescribe|xit(",
        action: "block",
        reason:
          "skipped tests create blind spots. Fix, delete, or use `it.todo()` instead (read skill: vitest)",
      },
    ],
  },
];

export default defaults;
