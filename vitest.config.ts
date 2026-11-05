import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    clearMocks: true,
    exclude: process.env.INTEGRATION_DATABASE_URL ? [] : ["**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/modules/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
