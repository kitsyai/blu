import { describe, expect, it } from "vitest";
import { ErrorCollector, err, makeError, ok } from "./result.js";

describe("ok / err", () => {
  it("ok wraps a value", () => {
    const r = ok({ x: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ x: 1 });
  });

  it("err wraps errors", () => {
    const r = err<number>([makeError("path", "code.x", "boom")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(1);
  });
});

describe("ErrorCollector", () => {
  it("composes nested paths and surfaces child errors on the root", () => {
    const root = new ErrorCollector("");
    const routes = root.child("routes").child(2);
    routes.push("x.y", "msg", "view");
    // Children share the root's error sink, so pushes are visible from the root.
    expect(root.errors()).toEqual([
      { path: "routes[2].view", code: "x.y", message: "msg" },
    ]);
    expect(routes.errors()[0]?.path).toBe("routes[2].view");
    expect(root.hasErrors()).toBe(true);
  });

  it("merges other collectors and Results", () => {
    const a = new ErrorCollector("a");
    a.push("a.b", "x");
    const b = new ErrorCollector("");
    b.merge(a);
    expect(b.errors()).toHaveLength(1);
    b.merge(err<unknown>([makeError("p", "c", "m")]));
    expect(b.errors()).toHaveLength(2);
    b.merge([makeError("q", "c2", "m2")]);
    expect(b.errors()).toHaveLength(3);
  });

  it("uses bracket notation for numeric children at root", () => {
    const c = new ErrorCollector("");
    c.push("x", "m", 0);
    expect(c.errors()[0]?.path).toBe("0");
  });
});
