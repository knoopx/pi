import ts from "typescript-eslint";

export default ts.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...ts.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
