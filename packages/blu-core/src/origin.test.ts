import { describe, expect, it } from "vitest";
import { ORIGINS, isOrigin } from "./origin.js";

describe("ORIGINS", () => {
  it("contains the five origins", () => {
    expect(ORIGINS).toEqual(["user", "system", "sync", "replay", "migration"]);
  });
});

describe("isOrigin", () => {
  it.each(ORIGINS)("recognizes %s", (origin) => {
    expect(isOrigin(origin)).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isOrigin("agent")).toBe(false);
    expect(isOrigin(null)).toBe(false);
  });
});
