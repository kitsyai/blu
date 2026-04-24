import { describe, expect, it } from "vitest";
import { validateFormDefinition } from "./form.js";

describe("validateFormDefinition", () => {
  it("accepts a minimal form", () => {
    const r = validateFormDefinition({
      id: "signup",
      fields: { email: { type: "text" } },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects missing id", () => {
    const r = validateFormDefinition({ fields: {} });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown field type", () => {
    const r = validateFormDefinition({
      id: "f",
      fields: { x: { type: "rainbow" } },
    });
    expect(r.ok).toBe(false);
  });

  it("validates select enum entries", () => {
    const r = validateFormDefinition({
      id: "f",
      fields: { x: { type: "select", enum: ["only-string"] } },
    });
    expect(r.ok).toBe(false);
  });

  it("validates submitAction recursively", () => {
    const r = validateFormDefinition({
      id: "f",
      fields: {},
      submitAction: { kind: "emit" },
    });
    expect(r.ok).toBe(false);
  });

  it("validates each validation rule", () => {
    const r = validateFormDefinition({
      id: "f",
      fields: {},
      validation: [{ message: "missing id" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain("form.validation.missing.id");
      expect(codes).toContain("form.validation.missing.when");
    }
  });
});
