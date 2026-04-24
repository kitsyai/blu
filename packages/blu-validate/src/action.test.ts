import { describe, expect, it } from "vitest";
import { validateAction } from "./action.js";

describe("validateAction", () => {
  it("accepts navigate with a string target", () => {
    expect(validateAction({ kind: "navigate", to: "/home" }).ok).toBe(true);
  });

  it("accepts navigate with a Binding target", () => {
    const r = validateAction({
      kind: "navigate",
      to: { source: "projection", path: "route.next" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects unknown kind", () => {
    const r = validateAction({ kind: "fly" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("action.invalid.kind");
  });

  it("rejects emit without a type", () => {
    const r = validateAction({ kind: "emit" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "action.emit.missing.type")).toBe(
        true,
      );
    }
  });

  it("rejects emit with an invalid event class", () => {
    const r = validateAction({ kind: "emit", type: "x:y:z", class: "command" });
    expect(r.ok).toBe(false);
  });

  it("rejects emit with an invalid durability", () => {
    const r = validateAction({
      kind: "emit",
      type: "x:y:z",
      durability: "rock",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects form setField without a field or value", () => {
    const r = validateAction({ kind: "form", op: "setField", form: "f1" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain("action.form.setField.missing.field");
      expect(codes).toContain("action.form.setField.missing.value");
    }
  });

  it("recursively validates composite steps and onError", () => {
    const r = validateAction({
      kind: "composite",
      steps: [
        { kind: "form", op: "validate", form: "f1" },
        { kind: "emit", type: "x:y:z" },
      ],
      onError: { kind: "navigate", to: "/oops" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects composite without steps", () => {
    const r = validateAction({ kind: "composite", steps: [] });
    expect(r.ok).toBe(false);
  });
});
