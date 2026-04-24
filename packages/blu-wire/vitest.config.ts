import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "blu-wire",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
