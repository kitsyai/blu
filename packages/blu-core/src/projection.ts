import type { BluEvent } from "./event.js";
import type { Authority } from "./authority.js";

/**
 * A registered read-model. Pure function over events; same state + same
 * event always yield the same output.
 *
 * See `docs/blu/specification.md` §5.
 */
export interface Projection<TState, TEvent extends BluEvent = BluEvent> {
  /** Unique identifier; used as the projection's address in slate.getProjection(). */
  name: string;
  /** Where this projection's truth lives. Enforced by the slate. */
  authority: Authority;
  /** Optional scope path filter; only events matching the path reach reduce(). */
  scope?: string;
  /** Optional predicate refining which events the projection sees. */
  eventFilter?: (event: BluEvent) => boolean;

  /** Initial state when no snapshot is available. */
  initialState: TState;
  /** Pure reducer. Must be deterministic. */
  reduce: (state: TState, event: TEvent) => TState;

  /** Optional snapshot policy. Required for journals long enough to slow replay. */
  snapshot?: ProjectionSnapshotPolicy<TState>;
}

/**
 * Snapshot policy for a projection. The slate periodically calls
 * `serialize(state)` and persists the result; on cold start it calls
 * `deserialize(raw)` and replays only events newer than the snapshot.
 */
export interface ProjectionSnapshotPolicy<TState> {
  serialize: (state: TState) => unknown;
  deserialize: (raw: unknown) => TState;
  /** Snapshot every N events. Defaults are slate-implementation-specific. */
  interval?: number;
}

/**
 * Handle returned by `slate.registerProjection`. Lets the caller read the
 * current state, subscribe to changes, and unregister.
 */
export interface ProjectionHandle<TState> {
  /** Read the current projected state. Synchronous. */
  read: () => TState;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe: (listener: (state: TState) => void) => Unsubscribe;
  /** Unregister the projection from the slate. */
  unregister: () => void;
}

/** Common unsubscribe shape used across the framework. */
export type Unsubscribe = () => void;
