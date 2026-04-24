import {
  applyEnvelopeDefaults,
  propagateCausality,
  type BluEvent,
  type PartialEvent,
  type Unsubscribe,
} from "@kitsy/blu-core";
import { validateEvent, type ValidationError } from "@kitsy/blu-validate";

export const BUS_HANDLER_ERROR_TYPE = "system:bus:handler-error";
export const BUS_EMISSION_REJECTED_TYPE = "system:bus:emission-rejected";

const BUS_EMITTER = "urn:blu:system:bus";
const BUS_SCOPE_PATH = "app/system/bus";

/** Predicate filter used to decide whether a subscriber should receive an event. */
export type EventPredicate = (event: BluEvent) => boolean;

/**
 * Structured filter for event subscriptions.
 *
 * `type` accepts either an exact event type (`cart:item:added`) or a
 * namespace prefix ending in `:*` (`cart:*`).
 */
export interface EventFilterObject {
  type?: string;
  scopePath?: string;
  predicate?: EventPredicate;
}

/** Supported event filter forms for bus subscriptions. */
export type EventFilter = string | EventPredicate | EventFilterObject;

/** Subscriber callback invoked for matching events. */
export type BusHandler = (event: BluEvent) => void | Promise<void>;

/**
 * Middleware invoked before subscribers.
 *
 * Middleware may annotate the envelope and may short-circuit dispatch by
 * choosing not to call `next()`. Payload mutation is blocked at runtime by
 * freezing the emitted payload before middleware runs.
 */
export type BusMiddleware = (
  event: BluEvent<unknown>,
  next: () => Promise<void>,
) => void | Promise<void>;

/** Payload emitted when the bus rejects an invalid attempted emission. */
export interface BusEmissionRejectedPayload {
  attemptedType: string | null;
  attemptedEmitter: string | null;
  attemptedScopePath: string | null;
  errors: ValidationError[];
}

/** Payload emitted when a subscriber throws while handling an event. */
export interface BusHandlerErrorPayload {
  failedEventId: string;
  failedEventType: string;
  handlerId: number;
  handlerName: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
}

/** Construction options for a bus instance. */
export interface BusOptions {
  now?: () => number;
}

/** Public contract implemented by `BluBus`. */
export interface Bus {
  /**
   * Emit an event into the bus.
   *
   * The bus finalizes the envelope, runs middleware, validates the event,
   * and dispatches to matching subscribers. If a subscriber emits a nested
   * event while handling this one, the child inherits causality from the
   * surrounding handler context automatically.
   */
  emit<T>(event: PartialEvent<T>): Promise<BluEvent<T>>;

  /**
   * Subscribe to events matching the provided filter.
   *
   * String filters match exact types unless they end in `:*`, in which case
   * they match that namespace prefix. Scope-path filters match the exact
   * path and any descendant path below it.
   */
  subscribe(filter: EventFilter, handler: BusHandler): Unsubscribe;

  /** Register middleware in insertion order. */
  use(middleware: BusMiddleware): void;
}

interface Subscriber {
  id: number;
  filter: EventPredicate;
  handler: BusHandler;
  active: boolean;
}

interface HandlerErrorDetails {
  handlerId: number;
  handlerName: string;
  error: unknown;
}

interface InternalEmitOptions {
  allowValidationRejectionEvent: boolean;
}

/**
 * Concrete in-process bus implementation for Blu.
 *
 * Causal propagation uses an explicit handler-context stack rather than
 * AsyncLocalStorage. The stack is smaller, runtime-agnostic, and sufficient
 * for the synchronous/awaited handler model used by the bus.
 */
export class BluBus implements Bus {
  readonly #middlewares: BusMiddleware[] = [];
  readonly #subscribers: Subscriber[] = [];
  readonly #handlerContextStack: BluEvent[] = [];
  readonly #now: () => number;

  #nextSequence = 0;
  #nextSubscriberId = 0;

  constructor(options: BusOptions = {}) {
    this.#now = options.now ?? (() => Date.now());
  }

  async emit<T>(event: PartialEvent<T>): Promise<BluEvent<T>> {
    const emitted = await this.#emitInternal(event, {
      allowValidationRejectionEvent: true,
    });
    return emitted as BluEvent<T>;
  }

  subscribe(filter: EventFilter, handler: BusHandler): Unsubscribe {
    const subscriber: Subscriber = {
      id: this.#nextSubscriberId++,
      filter: createEventPredicate(filter),
      handler,
      active: true,
    };
    this.#subscribers.push(subscriber);
    return () => {
      subscriber.active = false;
      const index = this.#subscribers.indexOf(subscriber);
      if (index >= 0) {
        this.#subscribers.splice(index, 1);
      }
    };
  }

  use(middleware: BusMiddleware): void {
    this.#middlewares.push(middleware);
  }

  async #emitInternal<T>(
    partial: PartialEvent<T>,
    options: InternalEmitOptions,
  ): Promise<BluEvent<unknown>> {
    const parent = this.#currentHandlerEvent();
    const causalPartial = parent
      ? propagateCausality(parent, partial)
      : partial;
    const finalized = applyEnvelopeDefaults(causalPartial, this.#now());

    finalized.sequence = this.#nextSequence++;
    freezePayload(finalized.payload);

    const pipeline = [
      ...this.#middlewares,
      this.#validationMiddleware(options),
    ];

    await runMiddlewarePipeline(finalized, pipeline, async () => {
      await this.#dispatchSubscribers(finalized);
    });

    return finalized;
  }

  #validationMiddleware(options: InternalEmitOptions): BusMiddleware {
    return async (event, next) => {
      const result = validateEvent(event);
      if (result.ok) {
        await next();
        return;
      }

      if (!options.allowValidationRejectionEvent) {
        return;
      }

      await this.#emitValidationRejected(event, result.errors);
    };
  }

  async #dispatchSubscribers(event: BluEvent): Promise<void> {
    const subscribers = this.#subscribers.slice();
    for (const subscriber of subscribers) {
      if (!subscriber.active || !subscriber.filter(event)) {
        continue;
      }

      this.#handlerContextStack.push(event);
      try {
        await subscriber.handler(event);
      } catch (error) {
        await this.#handleSubscriberError(event, subscriber, error);
      } finally {
        this.#handlerContextStack.pop();
      }
    }
  }

  async #handleSubscriberError(
    event: BluEvent,
    subscriber: Subscriber,
    error: unknown,
  ): Promise<void> {
    if (event.type === BUS_HANDLER_ERROR_TYPE) {
      return;
    }

    await this.#emitSystemEvent<BusHandlerErrorPayload>({
      type: BUS_HANDLER_ERROR_TYPE,
      schemaVersion: 1,
      class: "system",
      durability: "ephemeral",
      payload: createHandlerErrorPayload(event, {
        handlerId: subscriber.id,
        handlerName: subscriber.handler.name || `handler-${subscriber.id}`,
        error,
      }),
      emitter: BUS_EMITTER,
      scopePath: BUS_SCOPE_PATH,
      origin: "system",
    });
  }

  async #emitValidationRejected(
    attemptedEvent: BluEvent,
    errors: ValidationError[],
  ): Promise<void> {
    await this.#emitSystemEvent<BusEmissionRejectedPayload>({
      type: BUS_EMISSION_REJECTED_TYPE,
      schemaVersion: 1,
      class: "system",
      durability: "ephemeral",
      payload: {
        attemptedType:
          typeof attemptedEvent.type === "string" ? attemptedEvent.type : null,
        attemptedEmitter:
          typeof attemptedEvent.emitter === "string"
            ? attemptedEvent.emitter
            : null,
        attemptedScopePath:
          typeof attemptedEvent.scopePath === "string"
            ? attemptedEvent.scopePath
            : null,
        errors,
      },
      emitter: BUS_EMITTER,
      scopePath: BUS_SCOPE_PATH,
      origin: "system",
    });
  }

  async #emitSystemEvent<TPayload>(
    partial: PartialEvent<TPayload>,
  ): Promise<BluEvent<TPayload>> {
    const event = await this.#emitInternal(partial, {
      allowValidationRejectionEvent: false,
    });
    return event as BluEvent<TPayload>;
  }

  #currentHandlerEvent(): BluEvent | undefined {
    return this.#handlerContextStack[this.#handlerContextStack.length - 1];
  }
}

/** Create a new `BluBus` instance. */
export function createBus(options: BusOptions = {}): Bus {
  return new BluBus(options);
}

function createHandlerErrorPayload(
  event: BluEvent,
  details: HandlerErrorDetails,
): BusHandlerErrorPayload {
  const normalized = normalizeError(details.error);
  return {
    failedEventId: event.eventId,
    failedEventType: event.type,
    handlerId: details.handlerId,
    handlerName: details.handlerName,
    errorName: normalized.name,
    errorMessage: normalized.message,
    errorStack: normalized.stack,
  };
}

function createEventPredicate(filter: EventFilter): EventPredicate {
  if (typeof filter === "string") {
    return createTypePredicate(filter);
  }
  if (typeof filter === "function") {
    return filter;
  }

  const predicates: EventPredicate[] = [];
  if (filter.type !== undefined) {
    predicates.push(createTypePredicate(filter.type));
  }
  if (filter.scopePath !== undefined) {
    const scopePath = filter.scopePath;
    predicates.push((event) => matchesScopePath(scopePath, event.scopePath));
  }
  if (filter.predicate !== undefined) {
    predicates.push(filter.predicate);
  }

  if (predicates.length === 0) {
    return () => true;
  }

  return (event) => predicates.every((predicate) => predicate(event));
}

function createTypePredicate(filter: string): EventPredicate {
  if (filter.endsWith(":*")) {
    const prefix = filter.slice(0, -2);
    return (event) =>
      event.type === prefix || event.type.startsWith(`${prefix}:`);
  }
  return (event) => event.type === filter;
}

function matchesScopePath(filter: string, scopePath: string): boolean {
  const normalized = trimTrailingSlashes(filter);
  const candidate = trimTrailingSlashes(scopePath);
  return candidate === normalized || candidate.startsWith(`${normalized}/`);
}

async function runMiddlewarePipeline(
  event: BluEvent<unknown>,
  middlewares: readonly BusMiddleware[],
  dispatch: () => Promise<void>,
): Promise<void> {
  let index = -1;

  const invoke = async (position: number): Promise<void> => {
    if (position <= index) {
      throw new Error("Bus middleware called next() more than once.");
    }
    index = position;

    if (position === middlewares.length) {
      await dispatch();
      return;
    }

    const middleware = middlewares[position]!;
    await middleware(event, async () => invoke(position + 1));
  };

  await invoke(0);
}

function freezePayload<T>(payload: T): T {
  if (typeof payload !== "object" || payload === null) {
    return payload;
  }

  const seen = new WeakSet<object>();
  deepFreeze(payload, seen);
  return payload;
}

function deepFreeze(value: object, seen: WeakSet<object>): void {
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  for (const key of [
    ...Object.getOwnPropertyNames(value),
    ...Object.getOwnPropertySymbols(value),
  ]) {
    const nested = Reflect.get(value, key);
    if (typeof nested === "object" && nested !== null) {
      deepFreeze(nested, seen);
    }
  }

  Object.freeze(value);
}

function normalizeError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : String(error),
  };
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}
