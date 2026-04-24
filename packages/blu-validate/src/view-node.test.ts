import { describe, expect, it } from "vitest";
import { validateViewNode } from "./view-node.js";

describe("validateViewNode", () => {
  it("accepts a minimal node", () => {
    expect(validateViewNode({ component: "urn:blu:ui:text" }).ok).toBe(true);
  });

  it("rejects a non-URN component", () => {
    const r = validateViewNode({ component: "Button" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("view.invalid.component");
  });

  it("rejects missing component", () => {
    const r = validateViewNode({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("view.missing.component");
  });

  it("validates nested children recursively", () => {
    const r = validateViewNode({
      component: "urn:blu:layout:stack",
      children: [{ component: "Button" }, { component: "urn:blu:ui:text" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.path).toContain("children[0]");
    }
  });

  it("validates bindings", () => {
    const r = validateViewNode({
      component: "urn:blu:ui:text",
      bindings: { value: { source: "elsewhere", path: "x" } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "binding.invalid.source")).toBe(
        true,
      );
    }
  });

  it("validates actions", () => {
    const r = validateViewNode({
      component: "urn:blu:ui:button",
      actions: { click: { kind: "emit" } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "action.emit.missing.type")).toBe(
        true,
      );
    }
  });

  it("validates repeat directive", () => {
    const r = validateViewNode({
      component: "urn:blu:ui:list",
      repeat: { over: { source: "projection", path: "items" }, as: "" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "view.repeat.missing.as")).toBe(
        true,
      );
    }
  });
});
