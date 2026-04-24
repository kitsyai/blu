import {
  createEventId,
  type BluEvent,
  type Unsubscribe,
} from "@kitsy/blu-core";

export const TRANSPORT_ERROR_EVENT_TYPE = "sync:transport:error";
export const TRANSPORT_RESUMED_EVENT_TYPE = "sync:session:resumed";

/** Transport lifecycle status. */
export type TransportStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

/** Event payload emitted for transport lifecycle changes. */
export interface TransportLifecyclePayload {
  transport: string;
  status: TransportStatus;
  detail?: string;
}

/** Listener invoked when an incoming event arrives from a peer. */
export type TransportReceiveHandler = (event: BluEvent) => void | Promise<void>;

/** Listener invoked when transport-local lifecycle events occur. */
export type TransportLifecycleListener = (
  event: BluEvent<TransportLifecyclePayload>,
) => void;

/** Minimal channel contract used by `BroadcastChannelTransport`. */
export interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
  close(): void;
}

/** Constructor shape for producing broadcast channels. */
export interface BroadcastChannelConstructor {
  new (name: string): BroadcastChannelLike;
}

/** Canonical transport contract for replicated Blu events. */
export interface Transport {
  readonly name: string;
  readonly status: TransportStatus;

  /**
   * Offer a replicated event to the transport.
   *
   * Returns `true` when the transport accepted the event for delivery.
   */
  offer(event: BluEvent): boolean | Promise<boolean>;

  /** Register a handler for incoming peer events. */
  receive(handler: TransportReceiveHandler): Unsubscribe;

  /** Subscribe to transport-local lifecycle events. */
  subscribeLifecycle(listener: TransportLifecycleListener): Unsubscribe;

  /** Connect the transport. */
  connect(): Promise<void>;

  /** Disconnect the transport. */
  disconnect(): Promise<void>;
}

interface LifecycleTarget {
  readonly name: string;
  readonly status: TransportStatus;
}

/** Shared transport base for status tracking and lifecycle event emission. */
export abstract class BaseTransport implements Transport {
  readonly #receiveHandlers = new Set<TransportReceiveHandler>();
  readonly #lifecycleListeners = new Set<TransportLifecycleListener>();
  readonly #now: () => number;

  #status: TransportStatus = "idle";
  #lifecycleSequence = 0;

  constructor(
    readonly name: string,
    now: () => number = () => Date.now(),
  ) {
    this.#now = now;
  }

  get status(): TransportStatus {
    return this.#status;
  }

  abstract offer(event: BluEvent): boolean | Promise<boolean>;

  receive(handler: TransportReceiveHandler): Unsubscribe {
    this.#receiveHandlers.add(handler);
    return () => {
      this.#receiveHandlers.delete(handler);
    };
  }

  subscribeLifecycle(listener: TransportLifecycleListener): Unsubscribe {
    this.#lifecycleListeners.add(listener);
    return () => {
      this.#lifecycleListeners.delete(listener);
    };
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  protected async deliver(event: BluEvent): Promise<void> {
    for (const handler of [...this.#receiveHandlers]) {
      await handler(event);
    }
  }

  protected setStatus(status: TransportStatus, detail?: string): void {
    const previous = this.#status;
    this.#status = status;

    const lifecycleEvent = createLifecycleEvent(
      this,
      status,
      this.#lifecycleSequence++,
      this.#now(),
      detail,
    );
    for (const listener of this.#lifecycleListeners) {
      listener(lifecycleEvent);
    }

    if (
      previous === "error" &&
      status === "connected" &&
      lifecycleEvent.type !== TRANSPORT_RESUMED_EVENT_TYPE
    ) {
      // Unreachable today; `createLifecycleEvent` already emits resumed here.
    }
  }
}

function createLifecycleEvent(
  transport: LifecycleTarget,
  status: TransportStatus,
  sequence: number,
  timestamp: number,
  detail?: string,
): BluEvent<TransportLifecyclePayload> {
  const type =
    status === "error"
      ? TRANSPORT_ERROR_EVENT_TYPE
      : status === "connected"
        ? TRANSPORT_RESUMED_EVENT_TYPE
        : `sync:transport:${status}`;
  const eventId = createEventId(timestamp);

  return {
    eventId,
    type,
    schemaVersion: 1,
    class: "sync",
    durability: "ephemeral",
    payload: {
      transport: transport.name,
      status,
      detail,
    },
    emitter: `urn:blu:transport:${transport.name}`,
    scopePath: "app/system/transport",
    origin: "system",
    causationId: null,
    correlationId: eventId,
    timestamp,
    sequence,
  };
}
