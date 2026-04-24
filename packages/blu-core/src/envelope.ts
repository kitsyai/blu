import type { BluEvent, PartialEvent } from "./event.js";
import { createEventId } from "./event-id.js";

/**
 * Defaults used by `applyEnvelopeDefaults` when a field is absent from a
 * `PartialEvent`. The bus always overrides `sequence` after appending to
 * the slate, so the placeholder here (-1) is harmless: it signals "not yet
 * sequenced" to any consumer that inspects an in-flight event.
 */
export const ENVELOPE_DEFAULTS = Object.freeze({
  scopePath: "app",
  origin: "user" as const,
  causationId: null,
  pendingSequence: -1,
});

/**
 * Completes a `PartialEvent` into a `BluEvent` ready for slate append.
 *
 * The bus calls this between middleware and slate.append. It assigns a
 * `eventId` (ULID), stamps the `timestamp`, and fills any optional fields
 * the caller omitted. The `sequence` is left at `pendingSequence` so the
 * slate can assign a monotonically-increasing value during append.
 *
 * If `correlationId` is omitted, it defaults to the freshly generated
 * `eventId`, marking the event as a causal root.
 */
export function applyEnvelopeDefaults<T>(
  partial: PartialEvent<T>,
  now: number = Date.now(),
): BluEvent<T> {
  const eventId = createEventId(now);
  const correlationId = partial.correlationId ?? eventId;
  return {
    eventId,
    type: partial.type,
    schemaVersion: partial.schemaVersion,
    class: partial.class,
    durability: partial.durability,
    payload: partial.payload,
    emitter: partial.emitter,
    scopePath: partial.scopePath ?? ENVELOPE_DEFAULTS.scopePath,
    origin: partial.origin ?? ENVELOPE_DEFAULTS.origin,
    causationId: partial.causationId ?? ENVELOPE_DEFAULTS.causationId,
    correlationId,
    timestamp: now,
    sequence: ENVELOPE_DEFAULTS.pendingSequence,
  };
}
