import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {

    setupFiles: ["../../shared/testing/test-factories.ts"],
    coverage: {
      provider: "v8",
      include: ["**/*.ts"],
      exclude: ["eslint.config.ts", "vitest.config.ts", "**/*.test.ts"],
    },
  },
});
