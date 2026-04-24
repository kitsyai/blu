import { describe, expect, it } from "vitest";
import { validateApplicationConfiguration } from "./application.js";

const minimal = () => ({
  id: "demo",
  name: "Demo",
  version: "1.0.0",
  entry: { inline: { component: "urn:blu:ui:text", props: { value: "hi" } } },
});

describe("validateApplicationConfiguration", () => {
  it("accepts a minimal configuration", () => {
    expect(validateApplicationConfiguration(minimal()).ok).toBe(true);
  });

  it("rejects missing id, name, or version", () => {
    const r = validateApplicationConfiguration({ entry: minimal().entry });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain("app.missing.id");
      expect(codes).toContain("app.missing.name");
      expect(codes).toContain("app.invalid.version");
    }
  });

  it("rejects an entry that is neither inline nor ref", () => {
    const r = validateApplicationConfiguration({ ...minimal(), entry: {} });
    expect(r.ok).toBe(false);
  });

  it("rejects an entry that has both inline and ref", () => {
    const r = validateApplicationConfiguration({
      ...minimal(),
      entry: {
        inline: { component: "urn:blu:ui:text" },
        ref: "urn:app:view:home",
      },
    });
    expect(r.ok).toBe(false);
  });

  it("validates routes recursively", () => {
    const r = validateApplicationConfiguration({
      ...minimal(),
      routes: {
        routes: [{ path: "", view: { ref: "urn:app:view:home" } }],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "app.routes.entry.missing.path")).toBe(true);
    }
  });

  it("validates dataSources recursively", () => {
    const r = validateApplicationConfiguration({
      ...minimal(),
      dataSources: [{ source: { kind: "rest", id: "u", url: 5 } }],
    });
    expect(r.ok).toBe(false);
  });

  it("validates projections", () => {
    const r = validateApplicationConfiguration({
      ...minimal(),
      projections: [{ name: "p", kind: "k", authority: "weird" }],
    });
    expect(r.ok).toBe(false);
  });

  it("validates the event registry", () => {
    const r = validateApplicationConfiguration({
      ...minimal(),
      eventRegistry: [
        {
          type: "x:y:z",
          defaultClass: "command",
          defaultDurability: "always",
          schemaVersion: 1.5,
        },
      ],
    });
    expect(r.ok).toBe(false);
  });
});
