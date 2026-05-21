import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["**/*.ts"],
      exclude: ["eslint.config.ts", "vitest.config.ts", "**/*.test.ts"],
    },
  },
});
