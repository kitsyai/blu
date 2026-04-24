import type { EventClass } from "./event-class.js";
import type { Durability } from "./durability.js";
import type { Origin } from "./origin.js";

/**
 * The canonical event envelope. Every event in Blu — whether emitted by
 * application code, a projection, the runtime, or a transport — conforms
 * to this shape.
 *
 * See `docs/blu/specification.md` §1.
 */
export interface BluEvent<TPayload = unknown> {
  // Identity
  /** ULID. Globally unique. */
  eventId: string;
  /** Namespaced type, e.g. `cart:item:added`. */
  type: string;
  /** Monotonic integer per event type. Bumped on payload-shape change. */
  schemaVersion: number;

  // Classification
  /** intent | fact | system | projection | sync | devtools */
  class: EventClass;
  /** ephemeral | observable | journaled | replicated */
  durability: Durability;

  // Payload
  payload: TPayload;

  // Context
  /** URN or logical identity of the emitter. */
  emitter: string;
  /** Hierarchical scope path, e.g. `app/feature/cart`. */
  scopePath: string;
  /** user | system | sync | replay | migration */
  origin: Origin;

  // Causality
  /** Immediate parent event id; null for causal roots. */
  causationId: string | null;
  /** Root of the causal chain. Shared by every event in the transaction. */
  correlationId: string;

  // Timing
  /** Milliseconds since epoch. */
  timestamp: number;
  /** Monotonic per-slate sequence number. Assigned by the slate on append. */
  sequence: number;
}

/**
 * The shape accepted by `bus.emit`. The bus fills in `eventId`, `timestamp`,
 * and `sequence`; if the emission happens inside another event's handler,
 * the bus also auto-fills `causationId` and `correlationId` from the
 * surrounding context. Explicit values always win.
 */
export type PartialEvent<TPayload = unknown> = Omit<
  BluEvent<TPayload>,
  "eventId" | "timestamp" | "sequence"
> &
  Partial<
    Pick<
      BluEvent<TPayload>,
      "causationId" | "correlationId" | "scopePath" | "origin"
    >
  >;
