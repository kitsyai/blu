/**
 * The six authority declarations. Authority is the contract that prevents
 * silent drift — every developer reading a projection knows where its truth
 * lives from its declaration.
 *
 * - `local-only`               Never persisted, never synced; dies with the session.
 * - `local-authoritative`      Truth is local; may be snapshotted for next session.
 * - `projection-authoritative` Derived from local events; re-computable from journal.
 * - `browser-authoritative`    Persisted in the browser across sessions.
 * - `server-authoritative`     Server is the truth; local is a cached view.
 * - `derived-only`             Pure function of other projections.
 *
 * See `docs/blu/specification.md` §6.
 */
export type Authority =
  | "local-only"
  | "local-authoritative"
  | "projection-authoritative"
  | "browser-authoritative"
  | "server-authoritative"
  | "derived-only";

/** All authority declarations as a frozen tuple. */
export const AUTHORITIES = Object.freeze([
  "local-only",
  "local-authoritative",
  "projection-authoritative",
  "browser-authoritative",
  "server-authoritative",
  "derived-only",
] as const);

/** Runtime predicate to check whether a value is a valid authority. */
export function isAuthority(value: unknown): value is Authority {
  return (
    typeof value === "string" &&
    (AUTHORITIES as readonly string[]).includes(value)
  );
}

/**
 * Returns true when the authority requires events to be journaled
 * (local-authoritative, projection-authoritative, browser-authoritative,
 * server-authoritative). `local-only` and `derived-only` skip the journal.
 */
export function authorityRequiresJournal(authority: Authority): boolean {
  return authority !== "local-only" && authority !== "derived-only";
}

/**
 * Returns true when the authority allows transport replication.
 * Only server-authoritative projections accept replicated events from peers.
 */
export function authorityAcceptsReplication(authority: Authority): boolean {
  return authority === "server-authoritative";
}
