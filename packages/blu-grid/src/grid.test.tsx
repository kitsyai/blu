import React from "react";
import { describe, expect, it } from "vitest";
import { Row, Stack, bluGridEntries } from "./grid.js";

describe("@kitsy/blu-grid", () => {
  it("exports the minimal grid primitives and registry entries", () => {
    expect(typeof Stack).toBe("function");
    expect(typeof Row).toBe("function");
    expect(bluGridEntries).toHaveLength(2);
  });
});
