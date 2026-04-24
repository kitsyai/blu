import { describe, expect, it } from "vitest";
import { validateDataSource } from "./data-source.js";

describe("validateDataSource", () => {
  it("accepts a rest source", () => {
    const r = validateDataSource({ kind: "rest", id: "u", url: "/api/u" });
    expect(r.ok).toBe(true);
  });

  it("rejects unknown kind", () => {
    const r = validateDataSource({ kind: "soap", id: "u", url: "/api/u" });
    expect(r.ok).toBe(false);
  });

  it("rejects rest with a non-string non-binding url", () => {
    const r = validateDataSource({ kind: "rest", id: "u", url: 123 });
    expect(r.ok).toBe(false);
  });

  it("rejects graphql without a query", () => {
    const r = validateDataSource({ kind: "graphql", id: "g", endpoint: "/g" });
    expect(r.ok).toBe(false);
  });

  it("rejects bus without on[]", () => {
    const r = validateDataSource({ kind: "bus", id: "b", on: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects projection without from", () => {
    const r = validateDataSource({ kind: "projection", id: "p" });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid authority value", () => {
    const r = validateDataSource({
      kind: "static",
      id: "s",
      data: 1,
      authority: "weird",
    });
    expect(r.ok).toBe(false);
  });
});
