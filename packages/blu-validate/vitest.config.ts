import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "blu-validate",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
