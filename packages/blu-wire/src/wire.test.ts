import { type BluEvent } from "@kitsy/blu-core";
import { describe, expect, it, vi } from "vitest";

import { BroadcastChannelTransport } from "./broadcast-channel-transport.js";
import { LocalTransport } from "./local-transport.js";
import {
  TRANSPORT_ERROR_EVENT_TYPE,
  TRANSPORT_RESUMED_EVENT_TYPE,
  type BroadcastChannelLike,
} from "./transport.js";

function createReplicatedEvent(
  sequence: number,
  overrides: Partial<BluEvent> = {},
): BluEvent {
  return {
    eventId: `01HWIRE${String(sequence).padStart(18, "0")}`,
    type: "cart:item:added",
    schemaVersion: 1,
    class: "fact",
    durability: "replicated",
    payload: { itemId: `sku-${sequence}` },
    emitter: "urn:blu:test:button",
    scopePath: "app/cart",
    origin: "user",
    causationId: null,
    correlationId: `01HCORR${String(sequence).padStart(18, "0")}`,
    timestamp: 1_700_000_000_000 + sequence,
    sequence,
    ...overrides,
  };
}

function createReceivingSlate() {
  const seen = new Set<string>();
  const journal: BluEvent[] = [];
  return {
    journal,
    append(event: BluEvent) {
      if (seen.has(event.eventId)) {
        return;
      }
      seen.add(event.eventId);
      journal.push(event);
    },
  };
}

class FakeBroadcastChannel implements BroadcastChannelLike {
  static readonly channels = new Map<
    string,
    Set<(event: { data: unknown }) => void>
  >();

  readonly #name: string;
  readonly #listeners = new Set<(event: { data: unknown }) => void>();

  constructor(name: string) {
    this.#name = name;
  }

  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void {
    if (type !== "message") {
      return;
    }
    this.#listeners.add(listener);
    const listeners =
      FakeBroadcastChannel.channels.get(this.#name) ??
      new Set<(event: { data: unknown }) => void>();
    listeners.add(listener);
    FakeBroadcastChannel.channels.set(this.#name, listeners);
  }

  removeEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void {
    if (type !== "message") {
      return;
    }
    this.#listeners.delete(listener);
    const listeners = FakeBroadcastChannel.channels.get(this.#name);
    listeners?.delete(listener);
    if (listeners !== undefined && listeners.size === 0) {
      FakeBroadcastChannel.channels.delete(this.#name);
    }
  }

  postMessage(message: unknown): void {
    const listeners = FakeBroadcastChannel.channels.get(this.#name);
    if (listeners === undefined) {
      return;
    }
    for (const listener of [...listeners]) {
      listener({ data: message });
    }
  }

  close(): void {
    for (const listener of this.#listeners) {
      this.removeEventListener("message", listener);
    }
  }
}

class ThrowingBroadcastChannel implements BroadcastChannelLike {
  constructor() {
    throw new Error("BroadcastChannel startup failed");
  }

  postMessage(_message: unknown): void {}
  addEventListener(
    _type: "message",
    _listener: (event: { data: unknown }) => void,
  ): void {}
  removeEventListener(
    _type: "message",
    _listener: (event: { data: unknown }) => void,
  ): void {}
  close(): void {}
}

describe("@kitsy/blu-wire", () => {
  it("LocalTransport propagates replicated events between peers", async () => {
    const first = new LocalTransport({ channelName: "local-test" });
    const second = new LocalTransport({ channelName: "local-test" });
    const receiver = createReceivingSlate();

    second.receive((event) => {
      receiver.append(event);
    });

    await first.connect();
    await second.connect();

    const accepted = await first.offer(createReplicatedEvent(0));

    expect(accepted).toBe(true);
    expect(receiver.journal).toHaveLength(1);
    expect(receiver.journal[0]!.sequence).toBe(0);
  });

  it("receivers can deduplicate duplicate event ids silently", async () => {
    const first = new LocalTransport({ channelName: "local-dedupe" });
    const second = new LocalTransport({ channelName: "local-dedupe" });
    const receiver = createReceivingSlate();

    second.receive((event) => {
      receiver.append(event);
    });

    await first.connect();
    await second.connect();

    const event = createReplicatedEvent(1);
    await first.offer(event);
    await first.offer(event);

    expect(receiver.journal).toHaveLength(1);
  });

  it("BroadcastChannelTransport propagates replicated events both directions", async () => {
    const first = new BroadcastChannelTransport({
      channelName: "broadcast-test",
      BroadcastChannel: FakeBroadcastChannel,
    });
    const second = new BroadcastChannelTransport({
      channelName: "broadcast-test",
      BroadcastChannel: FakeBroadcastChannel,
    });

    const firstReceiver = createReceivingSlate();
    const secondReceiver = createReceivingSlate();

    first.receive((event) => {
      firstReceiver.append(event);
    });
    second.receive((event) => {
      secondReceiver.append(event);
    });

    await first.connect();
    await second.connect();

    expect(first.offer(createReplicatedEvent(2))).toBe(true);
    expect(second.offer(createReplicatedEvent(3))).toBe(true);

    expect(firstReceiver.journal.map((event) => event.sequence)).toEqual([3]);
    expect(secondReceiver.journal.map((event) => event.sequence)).toEqual([2]);
  });

  it("emits transport error and resumed lifecycle events", async () => {
    const failing = new BroadcastChannelTransport({
      channelName: "missing-broadcast",
      BroadcastChannel: ThrowingBroadcastChannel,
    });
    const events: string[] = [];

    failing.subscribeLifecycle((event) => {
      events.push(event.type);
    });

    await expect(failing.connect()).rejects.toThrow(/startup failed/);
    expect(events).toContain(TRANSPORT_ERROR_EVENT_TYPE);

    const resumed = new BroadcastChannelTransport({
      channelName: "recoverable-broadcast",
      BroadcastChannel: FakeBroadcastChannel,
    });
    const resumedEvents: string[] = [];
    resumed.subscribeLifecycle((event) => {
      resumedEvents.push(event.type);
    });

    await resumed.connect();
    expect(resumedEvents).toContain(TRANSPORT_RESUMED_EVENT_TYPE);
  });

  it("returns false for non-replicated events and disconnected transports", async () => {
    const transport = new LocalTransport({ channelName: "local-acceptance" });

    expect(await transport.offer(createReplicatedEvent(4))).toBe(false);

    await transport.connect();
    expect(
      await transport.offer(
        createReplicatedEvent(5, { durability: "observable" }),
      ),
    ).toBe(false);
  });

  it("preserves deterministic order under concurrent LocalTransport offers", async () => {
    const first = new LocalTransport({ channelName: "local-ordering" });
    const second = new LocalTransport({ channelName: "local-ordering" });
    const receiver = createReceivingSlate();

    second.receive((event) => {
      receiver.append(event);
    });

    await first.connect();
    await second.connect();

    await Promise.all([
      first.offer(createReplicatedEvent(10)),
      first.offer(createReplicatedEvent(11)),
      first.offer(createReplicatedEvent(12)),
    ]);

    expect(receiver.journal.map((event) => event.sequence)).toEqual([
      10, 11, 12,
    ]);
  });

  it("exposes lifecycle events to subscribers", async () => {
    const transport = new LocalTransport({ channelName: "local-lifecycle" });
    const listener = vi.fn();

    transport.subscribeLifecycle(listener);

    await transport.connect();
    await transport.disconnect();

    expect(listener).toHaveBeenCalled();
    expect(
      listener.mock.calls.map((call) => (call[0] as BluEvent).type),
    ).toContain("sync:transport:disconnected");
  });
});
