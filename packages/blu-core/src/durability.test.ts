import { describe, expect, it } from "vitest";
import {
  DURABILITY_TIERS,
  isDurability,
  isJournaledTier,
  isReplicatedTier,
} from "./durability.js";

describe("DURABILITY_TIERS", () => {
  it("contains the four tiers in ascending persistence order", () => {
    expect(DURABILITY_TIERS).toEqual([
      "ephemeral",
      "observable",
      "journaled",
      "replicated",
    ]);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(DURABILITY_TIERS)).toBe(true);
  });
});

describe("isDurability", () => {
  it.each(DURABILITY_TIERS)("recognizes %s", (tier) => {
    expect(isDurability(tier)).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isDurability("durable")).toBe(false);
    expect(isDurability(undefined)).toBe(false);
    expect(isDurability(0)).toBe(false);
  });
});

describe("isJournaledTier", () => {
  it("is true for journaled and replicated only", () => {
    expect(isJournaledTier("journaled")).toBe(true);
    expect(isJournaledTier("replicated")).toBe(true);
    expect(isJournaledTier("observable")).toBe(false);
    expect(isJournaledTier("ephemeral")).toBe(false);
  });
});

describe("isReplicatedTier", () => {
  it("is true only for replicated", () => {
    expect(isReplicatedTier("replicated")).toBe(true);
    expect(isReplicatedTier("journaled")).toBe(false);
    expect(isReplicatedTier("observable")).toBe(false);
    expect(isReplicatedTier("ephemeral")).toBe(false);
  });
});
