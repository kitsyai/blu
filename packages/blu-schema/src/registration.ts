import type { Authority, Durability, EventClass } from "@kitsy/blu-core";

/**
 * Declarative registration of a projection inside an
 * `ApplicationConfiguration`. The runtime instantiates the projection
 * from the named `kind` and the supplied configuration.
 */
export interface ProjectionRegistration {
  /** Projection name. */
  name: string;
  /** URN of the projection implementation. */
  kind: string;
  /** Required authority declaration. */
  authority: Authority;
  /** Optional scope path filter. */
  scope?: string;
  /** Implementation-specific configuration. */
  config?: Record<string, unknown>;
}

/**
 * Declarative registration of an event type. Provides defaults and a
 * payload schema for runtime validation.
 */
export interface EventRegistration {
  /** Event type, e.g. `cart:item:added`. */
  type: string;
  /** Default class for events of this type. */
  defaultClass: EventClass;
  /** Default durability tier when the emission site does not override. */
  defaultDurability: Durability;
  /** Schema version this registration describes. */
  schemaVersion: number;
  /** JSON schema for the payload, encoded as serializable data. */
  payloadSchema?: Record<string, unknown>;
  /** Whether this event type may be emitted by application code. */
  emittableByApp?: boolean;
}
