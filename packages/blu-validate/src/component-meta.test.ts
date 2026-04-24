import { describe, expect, it } from "vitest";
import { validateComponentMeta } from "./component-meta.js";

describe("validateComponentMeta", () => {
  it("accepts a well-formed meta", () => {
    const r = validateComponentMeta({
      urn: "urn:blu:ui:button",
      displayName: "Button",
      description: "",
      category: "ui",
      version: "1.0.0",
      props: { type: "object", properties: {} },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects an invalid URN", () => {
    const r = validateComponentMeta({
      urn: "Button",
      displayName: "B",
      description: "",
      category: "ui",
      version: "1.0.0",
      props: { type: "object", properties: {} },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    const r = validateComponentMeta({
      urn: "urn:blu:ui:button",
      displayName: "B",
      description: "",
      category: "widget",
      version: "1.0.0",
      props: { type: "object", properties: {} },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-semver version", () => {
    const r = validateComponentMeta({
      urn: "urn:blu:ui:button",
      displayName: "B",
      description: "",
      category: "ui",
      version: "v1",
      props: { type: "object", properties: {} },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects missing properties on props", () => {
    const r = validateComponentMeta({
      urn: "urn:blu:ui:button",
      displayName: "B",
      description: "",
      category: "ui",
      version: "1.0.0",
      props: { type: "object" },
    });
    expect(r.ok).toBe(false);
  });
});
