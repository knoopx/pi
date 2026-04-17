import { config } from "eslint-antislop";

export default [
  { ignores: ["node_modules", "dist", "eslint.config.js"] },
  ...config,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "max-lines-per-function": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "antislop/no-placeholder-data": "off",
    },
  },
];
