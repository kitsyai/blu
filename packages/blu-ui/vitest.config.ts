import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "blu-ui",
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
