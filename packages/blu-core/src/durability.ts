/**
 * The four durability tiers. Each event declares its tier at emission time.
 * The runtime honors it: ephemeral events never reach the journal; replicated
 * events are both journaled and offered to transports.
 *
 * - `ephemeral`  Dispatched, consumed, discarded.
 * - `observable` Held in memory for the session (devtools, replay).
 * - `journaled`  Persisted locally (IndexedDB).
 * - `replicated` Persisted locally and offered to transports.
 *
 * See `docs/blu/specification.md` §3.
 */
export type Durability =
  | "ephemeral"
  | "observable"
  | "journaled"
  | "replicated";

/** All durability tiers as a frozen tuple, ordered by ascending persistence. */
export const DURABILITY_TIERS = Object.freeze([
  "ephemeral",
  "observable",
  "journaled",
  "replicated",
] as const);

/** Runtime predicate to check whether a value is a valid durability tier. */
export function isDurability(value: unknown): value is Durability {
  return (
    typeof value === "string" &&
    (DURABILITY_TIERS as readonly string[]).includes(value)
  );
}

/**
 * Returns true when the durability tier requires the event to be journaled.
 * `journaled` and `replicated` both produce a journal entry.
 */
export function isJournaledTier(durability: Durability): boolean {
  return durability === "journaled" || durability === "replicated";
}

/**
 * Returns true when the durability tier requires the event to be offered to
 * transports. Only `replicated` triggers transport hand-off.
 */
export function isReplicatedTier(durability: Durability): boolean {
  return durability === "replicated";
}
