import type { BluEvent, PartialEvent } from "./event.js";

/**
 * Preserves causality when one event derives from another.
 *
 * Any consumer that emits a derived event is **required** to:
 *   - copy the `correlationId` of the parent event onto the child
 *   - set the child's `causationId` to the parent's `eventId`
 *
 * This helper makes that mechanical: pass the parent and a partial child,
 * receive a partial child with both fields filled in. Explicit values on
 * the input win — the helper only fills missing fields.
 *
 * See `docs/blu/specification.md` §4.1.
 */
export function propagateCausality<TParent, TChild>(
  parent: BluEvent<TParent>,
  child: PartialEvent<TChild>,
): PartialEvent<TChild> {
  return {
    ...child,
    causationId: child.causationId ?? parent.eventId,
    correlationId: child.correlationId ?? parent.correlationId,
  };
}

/**
 * Returns true if the event is a causal root (no parent caused it).
 * Roots have `causationId === null` and `correlationId === eventId`.
 */
export function isCausalRoot(event: BluEvent): boolean {
  return event.causationId === null && event.correlationId === event.eventId;
}
