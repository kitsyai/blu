import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "blu-style",
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
