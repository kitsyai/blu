/**
 * The six event classes. Fixed and not extensible. The class field is a
 * type discriminator and a semantic contract.
 *
 * - `intent`     Something was requested; not yet a fact.
 * - `fact`       Something actually happened; the intent succeeded or not.
 * - `system`     The runtime itself emitted this.
 * - `projection` A projection recomputed; observable by other projections.
 * - `sync`       Transport activity (replication, session lifecycle).
 * - `devtools`   Tooling emitted this; never affects application state.
 *
 * See `docs/blu/specification.md` §2.
 */
export type EventClass =
  | "intent"
  | "fact"
  | "system"
  | "projection"
  | "sync"
  | "devtools";

/** All event classes as a frozen tuple, useful for runtime validation. */
export const EVENT_CLASSES = Object.freeze([
  "intent",
  "fact",
  "system",
  "projection",
  "sync",
  "devtools",
] as const);

/** Runtime predicate to check whether a value is a valid event class. */
export function isEventClass(value: unknown): value is EventClass {
  return (
    typeof value === "string" &&
    (EVENT_CLASSES as readonly string[]).includes(value)
  );
}
