import { isEventId, type BluEvent, type PartialEvent } from "@kitsy/blu-core";
import { describe, expect, it, vi } from "vitest";

import {
  BluBus,
  BUS_EMISSION_REJECTED_TYPE,
  BUS_HANDLER_ERROR_TYPE,
  createBus,
  type BusEmissionRejectedPayload,
  type BusHandlerErrorPayload,
} from "./bus.js";

function createBasePartialEvent<TPayload>(
  payload: TPayload,
): PartialEvent<TPayload> {
  return {
    type: "cart:item:added",
    schemaVersion: 1,
    class: "fact",
    durability: "observable",
    payload,
    emitter: "urn:blu:test:button",
  };
}

describe("BluBus", () => {
  it("finalizes the envelope and returns the dispatched event", async () => {
    const bus = new BluBus({ now: () => 1_700_000_000_000 });
    const seen: BluEvent[] = [];

    bus.subscribe("cart:item:added", (event) => {
      seen.push(event);
    });

    const emitted = await bus.emit(createBasePartialEvent({ itemId: "sku-1" }));

    expect(emitted.type).toBe("cart:item:added");
    expect(emitted.sequence).toBe(0);
    expect(emitted.timestamp).toBe(1_700_000_000_000);
    expect(isEventId(emitted.eventId)).toBe(true);
    expect(emitted.causationId).toBeNull();
    expect(emitted.correlationId).toBe(emitted.eventId);
    expect(emitted.scopePath).toBe("app");
    expect(emitted.origin).toBe("user");
    expect(seen).toEqual([emitted]);
  });

  it("runs middleware in order and lets middleware annotate the envelope", async () => {
    const bus = createBus();
    const order: string[] = [];
    const subscriber = vi.fn((event: BluEvent) => {
      order.push(`subscriber:${event.scopePath}`);
    });

    bus.use(async (event, next) => {
      order.push("m1:before");
      event.scopePath = "app/checkout/cart";
      await next();
      order.push("m1:after");
    });
    bus.use(async (_event, next) => {
      order.push("m2:before");
      await next();
      order.push("m2:after");
    });

    bus.subscribe("cart:*", subscriber);

    await bus.emit(createBasePartialEvent({ itemId: "sku-1" }));

    expect(order).toEqual([
      "m1:before",
      "m2:before",
      "subscriber:app/checkout/cart",
      "m2:after",
      "m1:after",
    ]);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("lets middleware short-circuit subscriber dispatch", async () => {
    const bus = createBus();
    const subscriber = vi.fn();

    bus.use((event) => {
      event.origin = "system";
    });
    bus.subscribe("cart:item:added", subscriber);

    const emitted = await bus.emit(createBasePartialEvent({ itemId: "sku-2" }));

    expect(emitted.origin).toBe("system");
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("supports exact type, namespace prefix, scope path, and predicate filters", async () => {
    const bus = createBus();
    const exact = vi.fn();
    const prefix = vi.fn();
    const scoped = vi.fn();
    const predicate = vi.fn();

    bus.subscribe("cart:item:added", exact);
    bus.subscribe("cart:*", prefix);
    bus.subscribe({ scopePath: "app/checkout" }, scoped);
    bus.subscribe(
      (event) => event.origin === "sync" && event.type === "cart:item:added",
      predicate,
    );

    await bus.emit({
      ...createBasePartialEvent({ itemId: "sku-1" }),
      scopePath: "app/checkout/cart",
      origin: "sync",
    });
    await bus.emit({
      ...createBasePartialEvent({ itemId: "sku-2" }),
      type: "profile:user:updated",
      scopePath: "app/profile",
    });

    expect(exact).toHaveBeenCalledTimes(1);
    expect(prefix).toHaveBeenCalledTimes(1);
    expect(scoped).toHaveBeenCalledTimes(1);
    expect(predicate).toHaveBeenCalledTimes(1);
  });

  it("propagates causality for nested emits from async handlers", async () => {
    const bus = createBus();
    const seen: BluEvent[] = [];

    bus.subscribe("cart:item:add-requested", async (event) => {
      seen.push(event);
      await Promise.resolve();
      await bus.emit({
        type: "cart:item:added",
        schemaVersion: 1,
        class: "fact",
        durability: "observable",
        payload: { itemId: "sku-1" },
        emitter: "urn:blu:test:reducer",
      });
    });
    bus.subscribe("cart:item:added", (event) => {
      seen.push(event);
    });

    const root = await bus.emit({
      type: "cart:item:add-requested",
      schemaVersion: 1,
      class: "intent",
      durability: "ephemeral",
      payload: { itemId: "sku-1" },
      emitter: "urn:blu:test:button",
    });

    const child = seen[1]!;
    expect(root.correlationId).toBe(root.eventId);
    expect(child.causationId).toBe(root.eventId);
    expect(child.correlationId).toBe(root.correlationId);
    expect(child.sequence).toBe(1);
  });

  it("isolates subscriber failures and emits a handler-error system event", async () => {
    const bus = createBus();
    const survivor = vi.fn();
    const errors: Array<BluEvent<BusHandlerErrorPayload>> = [];

    bus.subscribe("cart:item:added", () => {
      throw new Error("subscriber blew up");
    });
    bus.subscribe("cart:item:added", survivor);
    bus.subscribe(BUS_HANDLER_ERROR_TYPE, (event) => {
      errors.push(event as BluEvent<BusHandlerErrorPayload>);
    });

    const original = await bus.emit(
      createBasePartialEvent({ itemId: "sku-3" }),
    );

    expect(survivor).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.payload.failedEventId).toBe(original.eventId);
    expect(errors[0]!.payload.failedEventType).toBe(original.type);
    expect(errors[0]!.causationId).toBe(original.eventId);
    expect(errors[0]!.correlationId).toBe(original.correlationId);
  });

  it("emits a rejection system event when validation fails", async () => {
    const bus = createBus();
    const rejections: Array<BluEvent<BusEmissionRejectedPayload>> = [];
    const normalSubscriber = vi.fn();

    bus.subscribe(BUS_EMISSION_REJECTED_TYPE, (event) => {
      rejections.push(event as BluEvent<BusEmissionRejectedPayload>);
    });
    bus.subscribe("cart:item:added", normalSubscriber);

    const emitted = await bus.emit({
      ...createBasePartialEvent({ itemId: "sku-4" }),
      type: "INVALID TYPE",
    } as unknown as PartialEvent<{ itemId: string }>);

    expect(emitted.type).toBe("INVALID TYPE");
    expect(rejections).toHaveLength(1);
    expect(rejections[0]!.payload.attemptedType).toBe("INVALID TYPE");
    expect(rejections[0]!.payload.errors[0]!.code).toBe(
      "envelope.invalid.type",
    );
    expect(normalSubscriber).not.toHaveBeenCalled();
  });

  it("keeps payloads immutable for middleware and subscribers", async () => {
    const bus = createBus();
    const nested = { item: { id: "sku-5" } };
    const attempts: string[] = [];

    bus.use((event, next) => {
      expect(() => {
        (event.payload as { item: { id: string } }).item.id = "mutated";
      }).toThrow(TypeError);
      attempts.push("middleware");
      return next();
    });
    bus.subscribe("cart:item:added", (event) => {
      expect(() => {
        (event.payload as { item: { id: string } }).item.id = "mutated";
      }).toThrow(TypeError);
      attempts.push("subscriber");
    });

    await bus.emit(createBasePartialEvent(nested));

    expect(attempts).toEqual(["middleware", "subscriber"]);
    expect(nested.item.id).toBe("sku-5");
  });

  it("assigns sequences monotonically per bus instance", async () => {
    const firstBus = createBus();
    const secondBus = createBus();

    const first = await firstBus.emit(
      createBasePartialEvent({ itemId: "sku-1" }),
    );
    const second = await firstBus.emit(
      createBasePartialEvent({ itemId: "sku-2" }),
    );
    const third = await secondBus.emit(
      createBasePartialEvent({ itemId: "sku-3" }),
    );

    expect(first.sequence).toBe(0);
    expect(second.sequence).toBe(1);
    expect(third.sequence).toBe(0);
  });
});
