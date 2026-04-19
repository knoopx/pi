import type { Linter } from "eslint";
import base from "../../shared/eslint.config";

const config: Linter.Config[] = [
  ...base,
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test-utils.ts"],
    rules: {
      "max-lines-per-function": "off",
      "max-params": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
];

export default config;
