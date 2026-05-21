import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "linting",
    pattern: "eslint-config.*",
    rules: [
      {
        context: "file_content",
        file_pattern: "*.{js,jsx,ts,tsx,mjs,cjs}",
        pattern: "eslint-disable",
        action: "block",
        reason:
          "disabling lint rules hides issues. Fix the code or use inline `eslint-disable-next-line` with justification (read skill: eslint)",
      },
    ],
  },
];

export default defaults;
