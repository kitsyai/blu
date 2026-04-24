import { describe, expect, it } from "vitest";
import {
  createEventId,
  eventIdTimestamp,
  isEventId,
} from "./event-id.js";

describe("createEventId", () => {
  it("returns a 26-character ULID", () => {
    const id = createEventId();
    expect(id).toHaveLength(26);
    expect(isEventId(id)).toBe(true);
  });

  it("uses Crockford base32 alphabet (no I, L, O, U)", () => {
    const id = createEventId();
    expect(id).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/);
  });

  it("encodes the supplied timestamp losslessly", () => {
    const ts = 1714000000000;
    const id = createEventId(ts);
    expect(eventIdTimestamp(id)).toBe(ts);
  });

  it("produces ascending IDs across distinct timestamps", () => {
    const a = createEventId(100);
    const b = createEventId(200);
    expect(a < b).toBe(true);
  });

  it("produces monotonic IDs within the same millisecond", () => {
    const ts = Date.now();
    const ids = Array.from({ length: 8 }, () => createEventId(ts));
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects negative or non-finite timestamps", () => {
    expect(() => createEventId(-1)).toThrow(RangeError);
    expect(() => createEventId(Number.NaN)).toThrow(RangeError);
    expect(() => createEventId(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("isEventId", () => {
  it("accepts a freshly created ULID", () => {
    expect(isEventId(createEventId())).toBe(true);
  });

  it("rejects strings of the wrong length", () => {
    expect(isEventId("01234")).toBe(false);
    expect(isEventId("0".repeat(27))).toBe(false);
  });

  it("rejects strings containing non-Crockford characters", () => {
    expect(isEventId("I" + "0".repeat(25))).toBe(false);
    expect(isEventId("L" + "0".repeat(25))).toBe(false);
    expect(isEventId("U" + "0".repeat(25))).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isEventId(123)).toBe(false);
    expect(isEventId(null)).toBe(false);
    expect(isEventId(undefined)).toBe(false);
  });
});

describe("eventIdTimestamp", () => {
  it("throws on invalid input", () => {
    expect(() => eventIdTimestamp("not-a-ulid")).toThrow(TypeError);
  });
});
