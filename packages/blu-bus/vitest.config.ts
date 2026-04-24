import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "blu-bus",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
