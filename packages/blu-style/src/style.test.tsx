import React from "react";
import { describe, expect, it } from "vitest";
import { buildThemeStyles } from "./style.js";

describe("@kitsy/blu-style", () => {
  it("builds css variables from theme configuration", () => {
    const styles = buildThemeStyles(
      {
        namespace: "demo",
        colors: {
          primary: {
            500: "#0044ff",
          },
        },
        spacing: {
          md: 12,
        },
      },
      "dark",
      "compact",
    );

    expect(styles["--demo-color-primary-500" as keyof typeof styles]).toBe(
      "#0044ff",
    );
    expect(styles["--demo-space-md" as keyof typeof styles]).toBe(12);
    expect(styles["--blu-theme-mode" as keyof typeof styles]).toBe("dark");
  });
});
