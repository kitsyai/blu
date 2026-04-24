import { describe, expect, it } from "vitest";
import { applyEnvelopeDefaults } from "./envelope.js";
import { isCausalRoot, propagateCausality } from "./causality.js";
import type { PartialEvent } from "./event.js";

const root = applyEnvelopeDefaults<{ itemId: string }>({
  type: "cart:item:add-requested",
  schemaVersion: 1,
  class: "intent",
  durability: "journaled",
  payload: { itemId: "abc" },
  emitter: "urn:blu:ui:button",
});

describe("propagateCausality", () => {
  it("copies correlationId from parent and sets causationId to parent eventId", () => {
    const child: PartialEvent<{ itemId: string }> = {
      type: "cart:item:added",
      schemaVersion: 1,
      class: "fact",
      durability: "replicated",
      payload: { itemId: "abc" },
      emitter: "urn:blu:reducer:cart",
    };
    const stamped = propagateCausality(root, child);
    expect(stamped.causationId).toBe(root.eventId);
    expect(stamped.correlationId).toBe(root.correlationId);
  });

  it("does not overwrite explicit values on the child", () => {
    const child: PartialEvent<{ itemId: string }> = {
      type: "cart:item:added",
      schemaVersion: 1,
      class: "fact",
      durability: "replicated",
      payload: { itemId: "abc" },
      emitter: "urn:blu:reducer:cart",
      causationId: "01HXEXPLICITPARENT0000000A",
      correlationId: "01HXEXPLICITROOT00000000A0",
    };
    const stamped = propagateCausality(root, child);
    expect(stamped.causationId).toBe("01HXEXPLICITPARENT0000000A");
    expect(stamped.correlationId).toBe("01HXEXPLICITROOT00000000A0");
  });
});

describe("isCausalRoot", () => {
  it("recognizes a root event", () => {
    expect(isCausalRoot(root)).toBe(true);
  });

  it("returns false for derived events", () => {
    const derived = applyEnvelopeDefaults({
      ...propagateCausality(root, {
        type: "cart:item:added",
        schemaVersion: 1,
        class: "fact",
        durability: "replicated",
        payload: { itemId: "abc" },
        emitter: "urn:blu:reducer:cart",
      }),
    });
    expect(isCausalRoot(derived)).toBe(false);
  });
});
