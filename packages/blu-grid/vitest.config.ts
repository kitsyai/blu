import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "blu-grid",
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
