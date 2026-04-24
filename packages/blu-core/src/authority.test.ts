import { describe, expect, it } from "vitest";
import {
  AUTHORITIES,
  authorityAcceptsReplication,
  authorityRequiresJournal,
  isAuthority,
} from "./authority.js";

describe("AUTHORITIES", () => {
  it("contains the six authority declarations", () => {
    expect(AUTHORITIES).toEqual([
      "local-only",
      "local-authoritative",
      "projection-authoritative",
      "browser-authoritative",
      "server-authoritative",
      "derived-only",
    ]);
  });
});

describe("isAuthority", () => {
  it.each(AUTHORITIES)("recognizes %s", (a) => {
    expect(isAuthority(a)).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isAuthority("readonly")).toBe(false);
    expect(isAuthority(123)).toBe(false);
  });
});

describe("authorityRequiresJournal", () => {
  it("is false only for local-only and derived-only", () => {
    expect(authorityRequiresJournal("local-only")).toBe(false);
    expect(authorityRequiresJournal("derived-only")).toBe(false);
    expect(authorityRequiresJournal("local-authoritative")).toBe(true);
    expect(authorityRequiresJournal("projection-authoritative")).toBe(true);
    expect(authorityRequiresJournal("browser-authoritative")).toBe(true);
    expect(authorityRequiresJournal("server-authoritative")).toBe(true);
  });
});

describe("authorityAcceptsReplication", () => {
  it("is true only for server-authoritative", () => {
    expect(authorityAcceptsReplication("server-authoritative")).toBe(true);
    for (const a of AUTHORITIES) {
      if (a === "server-authoritative") continue;
      expect(authorityAcceptsReplication(a)).toBe(false);
    }
  });
});
