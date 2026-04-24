import { describe, expect, it } from "vitest";
import { EVENT_CLASSES, isEventClass } from "./event-class.js";

describe("EVENT_CLASSES", () => {
  it("contains all six classes in canonical order", () => {
    expect(EVENT_CLASSES).toEqual([
      "intent",
      "fact",
      "system",
      "projection",
      "sync",
      "devtools",
    ]);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(EVENT_CLASSES)).toBe(true);
  });
});

describe("isEventClass", () => {
  it("returns true for every canonical class", () => {
    for (const c of EVENT_CLASSES) {
      expect(isEventClass(c)).toBe(true);
    }
  });

  it("returns false for unrelated strings", () => {
    expect(isEventClass("command")).toBe(false);
    expect(isEventClass("query")).toBe(false);
    expect(isEventClass("")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isEventClass(null)).toBe(false);
    expect(isEventClass(undefined)).toBe(false);
    expect(isEventClass(42)).toBe(false);
    expect(isEventClass({})).toBe(false);
  });
});
