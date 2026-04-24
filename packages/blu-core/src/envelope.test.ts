import { describe, expect, it } from "vitest";
import { applyEnvelopeDefaults, ENVELOPE_DEFAULTS } from "./envelope.js";
import { isEventId } from "./event-id.js";
import type { PartialEvent } from "./event.js";

const minimal = (): PartialEvent<{ itemId: string }> => ({
  type: "cart:item:add-requested",
  schemaVersion: 1,
  class: "intent",
  durability: "journaled",
  payload: { itemId: "abc" },
  emitter: "urn:blu:ui:button",
});

describe("applyEnvelopeDefaults", () => {
  it("fills eventId, timestamp, and sequence", () => {
    const now = 1714000000000;
    const ev = applyEnvelopeDefaults(minimal(), now);
    expect(isEventId(ev.eventId)).toBe(true);
    expect(ev.timestamp).toBe(now);
    expect(ev.sequence).toBe(ENVELOPE_DEFAULTS.pendingSequence);
  });

  it("defaults scopePath, origin, and causationId", () => {
    const ev = applyEnvelopeDefaults(minimal());
    expect(ev.scopePath).toBe(ENVELOPE_DEFAULTS.scopePath);
    expect(ev.origin).toBe(ENVELOPE_DEFAULTS.origin);
    expect(ev.causationId).toBe(ENVELOPE_DEFAULTS.causationId);
  });

  it("treats events without correlationId as causal roots", () => {
    const ev = applyEnvelopeDefaults(minimal());
    expect(ev.correlationId).toBe(ev.eventId);
    expect(ev.causationId).toBeNull();
  });

  it("preserves explicit causality fields", () => {
    const partial = minimal();
    partial.causationId = "01HXPARENTID0000000000000A";
    partial.correlationId = "01HXROOTID000000000000000A";
    partial.scopePath = "app/checkout/cart";
    partial.origin = "system";
    const ev = applyEnvelopeDefaults(partial);
    expect(ev.causationId).toBe("01HXPARENTID0000000000000A");
    expect(ev.correlationId).toBe("01HXROOTID000000000000000A");
    expect(ev.scopePath).toBe("app/checkout/cart");
    expect(ev.origin).toBe("system");
  });

  it("does not mutate the input", () => {
    const partial = minimal();
    const before = JSON.stringify(partial);
    applyEnvelopeDefaults(partial);
    expect(JSON.stringify(partial)).toBe(before);
  });
});
