import { describe, expect, it } from "vitest";
import { applyEnvelopeDefaults, type PartialEvent } from "@kitsy/blu-core";
import { validateEvent, validatePartialEvent } from "./event.js";

const partial = (): PartialEvent<{ itemId: string }> => ({
  type: "cart:item:added",
  schemaVersion: 1,
  class: "fact",
  durability: "journaled",
  payload: { itemId: "abc" },
  emitter: "urn:blu:reducer:cart",
});

describe("validatePartialEvent", () => {
  it("accepts a minimal partial", () => {
    const r = validatePartialEvent(partial());
    expect(r.ok).toBe(true);
  });

  it("rejects non-object input", () => {
    const r = validatePartialEvent("not an event");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe("envelope.shape.notObject");
    }
  });

  it("rejects missing type, class, durability, emitter", () => {
    const r = validatePartialEvent({ schemaVersion: 1, payload: null });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain("envelope.missing.type");
      expect(codes).toContain("envelope.invalid.class");
      expect(codes).toContain("envelope.invalid.durability");
      expect(codes).toContain("envelope.missing.emitter");
    }
  });

  it("rejects malformed event types", () => {
    const r = validatePartialEvent({ ...partial(), type: "BadType" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === "envelope.invalid.type")).toBe(true);
  });

  it("rejects schemaVersion < 1", () => {
    const r = validatePartialEvent({ ...partial(), schemaVersion: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("validateEvent", () => {
  it("accepts a finalized envelope", () => {
    const ev = applyEnvelopeDefaults(partial());
    const r = validateEvent(ev);
    expect(r.ok).toBe(true);
  });

  it("rejects an envelope without eventId, timestamp, or correlationId", () => {
    const r = validateEvent({
      ...partial(),
      origin: "user",
      causationId: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain("envelope.missing.eventId");
      expect(codes).toContain("envelope.missing.timestamp");
      expect(codes).toContain("envelope.missing.correlationId");
    }
  });

  it("rejects a malformed eventId", () => {
    const ev = applyEnvelopeDefaults(partial());
    const r = validateEvent({ ...ev, eventId: "not-a-ulid" });
    expect(r.ok).toBe(false);
  });

  it("rejects a malformed correlationId", () => {
    const ev = applyEnvelopeDefaults(partial());
    const r = validateEvent({ ...ev, correlationId: "nope" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-null causationId that is not a ULID", () => {
    const ev = applyEnvelopeDefaults(partial());
    const r = validateEvent({ ...ev, causationId: "junk" });
    expect(r.ok).toBe(false);
  });

  it("requires the payload key (even when null)", () => {
    const ev = applyEnvelopeDefaults(partial()) as Record<string, unknown>;
    delete ev.payload;
    const r = validateEvent(ev);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === "envelope.missing.payload")).toBe(true);
    }
  });
});
