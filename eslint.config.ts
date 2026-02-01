import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
        fetch: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        TextEncoder: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        NodeJS: "readonly",
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-empty": "off", // Allow empty blocks in some cases
      "no-useless-escape": "off", // Allow unnecessary escapes if needed
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      "*.config.js",
      "agent/extensions/**/*.config.js",
    ],
  }
];