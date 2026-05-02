import ts from "typescript-eslint";
import importPlugin from "eslint-plugin-import-x";
export default ts.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...ts.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/unbound-method": "off",
      "import/extensions": ["error", "never"],
    },
  },
);
