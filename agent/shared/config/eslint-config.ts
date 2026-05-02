import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "*.js"] },
  ...tseslint.configs.recommended,
);
