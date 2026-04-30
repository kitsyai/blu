import React from "react";
import { describe, expect, it } from "vitest";
import { bluUiEntries } from "./ui.js";

describe("@kitsy/blu-ui", () => {
  it("exports the minimum Sprint 9 UI registry entries", () => {
    expect(bluUiEntries.map((entry) => entry.urn)).toEqual([
      "urn:blu:ui:button",
      "urn:blu:ui:text",
      "urn:blu:ui:input",
      "urn:blu:ui:card",
      "urn:blu:ui:modal-content",
    ]);
  });
});
