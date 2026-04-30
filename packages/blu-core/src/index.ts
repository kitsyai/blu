/**
 * @kitsy/blu-core — Layer 1 primitives.
 *
 * Re-exports the canonical types and helpers every Blu package depends on.
 * See `docs/blu/specification.md` §1–§6 for the underlying contracts.
 */

export type { BluEvent, PartialEvent } from "./event.js";
export type { EventClass } from "./event-class.js";
export type { Durability } from "./durability.js";
export type { Origin } from "./origin.js";
export type { Authority } from "./authority.js";
export type { RouteState } from "./route-state.js";
export type {
  Projection,
  ProjectionHandle,
  ProjectionSnapshotPolicy,
  Unsubscribe,
} from "./projection.js";

export { EVENT_CLASSES, isEventClass } from "./event-class.js";
export {
  DURABILITY_TIERS,
  isDurability,
  isJournaledTier,
  isReplicatedTier,
} from "./durability.js";
export { ORIGINS, isOrigin } from "./origin.js";
export {
  AUTHORITIES,
  isAuthority,
  authorityRequiresJournal,
  authorityAcceptsReplication,
} from "./authority.js";

export { createEventId, isEventId, eventIdTimestamp } from "./event-id.js";
export { applyEnvelopeDefaults, ENVELOPE_DEFAULTS } from "./envelope.js";
export { propagateCausality, isCausalRoot } from "./causality.js";
