import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "typescript-only",
    pattern: "tsconfig.json",
    rules: [
      {
        context: "file_name",
        pattern: "*.js",
        excludes: "eslint-config.js",
        action: "block",
        reason: "this project uses TypeScript. Create `.ts` files instead",
      },
    ],
  },
];

export default defaults;
