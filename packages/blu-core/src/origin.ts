/**
 * The five origin types. The `origin` field exists so projections can behave
 * differently during replay or sync than during live user activity.
 *
 * - `user`       Originated from a user interaction.
 * - `system`     Runtime emitted it autonomously (scheduler, lifecycle, recovery).
 * - `sync`       Arrived via a transport from another slate.
 * - `replay`     Re-dispatched during journal replay.
 * - `migration`  Re-dispatched from an older schema version after migration.
 *
 * See `docs/blu/specification.md` §4.
 */
export type Origin = "user" | "system" | "sync" | "replay" | "migration";

/** All origins as a frozen tuple. */
export const ORIGINS = Object.freeze([
  "user",
  "system",
  "sync",
  "replay",
  "migration",
] as const);

/** Runtime predicate to check whether a value is a valid origin. */
export function isOrigin(value: unknown): value is Origin {
  return (
    typeof value === "string" && (ORIGINS as readonly string[]).includes(value)
  );
}
