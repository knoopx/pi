import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "*.bin", "**/*.test.ts"] },
  {
    extends: tseslint.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
);
