import type { BluEvent, Projection } from "@kitsy/blu-core";
import { describe, expect, it, vi } from "vitest";

import { BluSlate, createSlate, type DerivedProjection } from "./slate.js";

function createEvent(
  sequence: number,
  overrides: Partial<BluEvent> = {},
): BluEvent<unknown> {
  return {
    eventId: `01HTEST${String(sequence).padStart(19, "0")}`,
    type: "cart:item:added",
    schemaVersion: 1,
    class: "fact",
    durability: "observable",
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

describe("BluSlate", () => {
  it("registers projections, appends journaled state, and notifies only on real changes", async () => {
    const slate = new BluSlate();
    const listener = vi.fn();

    const projection: Projection<{ count: number }> = {
      name: "cart-count",
      authority: "projection-authoritative",
      initialState: { count: 0 },
      reduce: (state, event) => {
        if (event.type === "cart:item:added") {
          return { count: state.count + 1 };
        }
        return { count: state.count };
      },
    };

    const handle = slate.registerProjection(projection);
    handle.subscribe(listener);

    await slate.append(createEvent(0));
    await slate.append(createEvent(1, { type: "cart:viewed" }));

    expect(handle.read()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0]).toEqual({ count: 1 });
  });

  it("replays the retained journal for projections registered after earlier events", async () => {
    const slate = createSlate() as BluSlate;

    await slate.append(createEvent(0));
    await slate.append(createEvent(1));

    slate.registerProjection<number>({
      name: "cart-count",
      authority: "projection-authoritative",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "cart:item:added" ? state + 1 : state,
    });

    expect(slate.getProjection<number>("cart-count")).toBe(2);
  });

  it("rejects non-fact writes to server-authoritative projections and preserves state", async () => {
    const slate = new BluSlate();

    slate.registerProjection<number>({
      name: "remote-cart",
      authority: "server-authoritative",
      initialState: 0,
      eventFilter: (event) => event.type.startsWith("cart:item:"),
      reduce: (state, event) =>
        event.type === "cart:item:added" ? state + 1 : state,
    });

    await expect(
      slate.append(
        createEvent(0, {
          type: "cart:item:add-requested",
          class: "intent",
        }),
      ),
    ).rejects.toThrow(/server-authoritative/);

    expect(slate.getProjection<number>("remote-cart")).toBe(0);

    await slate.append(createEvent(1));
    expect(slate.getProjection<number>("remote-cart")).toBe(1);
  });

  it("captures snapshots, compacts the journal, and replays from the snapshot plus tail", async () => {
    const slate = new BluSlate();

    slate.registerProjection<number>({
      name: "cart-count",
      authority: "projection-authoritative",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "cart:item:added" ? state + 1 : state,
      snapshot: {
        serialize: (state) => ({ count: state }),
        deserialize: (raw) => (raw as { count: number }).count,
      },
    });

    await slate.append(createEvent(0));
    await slate.append(createEvent(1));

    const snapshot = await slate.snapshot();
    await slate.compact(snapshot);

    await slate.append(createEvent(2));
    await slate.replay(snapshot);

    expect(slate.getProjection<number>("cart-count")).toBe(3);

    const sequences: number[] = [];
    for await (const event of slate.getJournal()) {
      sequences.push(event.sequence);
    }
    expect(sequences).toEqual([2]);
  });

  it("replays events with origin replay so reducers can discriminate", async () => {
    const slate = new BluSlate();

    slate.registerProjection<{ count: number; lastOrigin: string }>({
      name: "replay-aware",
      authority: "projection-authoritative",
      initialState: { count: 0, lastOrigin: "none" },
      reduce: (state, event) => ({
        count: event.type === "cart:item:added" ? state.count + 1 : state.count,
        lastOrigin: event.origin,
      }),
    });

    await slate.append(createEvent(0));
    expect(
      slate.getProjection<{ count: number; lastOrigin: string }>(
        "replay-aware",
      ),
    ).toEqual({ count: 1, lastOrigin: "user" });

    await slate.replay();

    expect(
      slate.getProjection<{ count: number; lastOrigin: string }>(
        "replay-aware",
      ),
    ).toEqual({ count: 1, lastOrigin: "replay" });
  });

  it("recomputes derived projections from their sources without journal churn", async () => {
    const slate = new BluSlate();

    slate.registerProjection<number>({
      name: "cart-count",
      authority: "projection-authoritative",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "cart:item:added" ? state + 1 : state,
    });

    const derived: DerivedProjection<string> = {
      name: "cart-label",
      authority: "derived-only",
      derivedFrom: ["cart-count"],
      computeFrom: (sources) => {
        const count = sources["cart-count"] as number;
        return count === 1 ? "1 item" : `${count} items`;
      },
    };

    slate.registerDerivedProjection(derived);

    await slate.append(createEvent(0));
    expect(slate.getProjection<string>("cart-label")).toBe("1 item");

    const journal: BluEvent[] = [];
    for await (const event of slate.getJournal()) {
      journal.push(event);
    }
    expect(journal).toHaveLength(1);
  });

  it("supports journal filtering by scope path, sequence range, and predicate", async () => {
    const slate = new BluSlate();

    await slate.append(createEvent(0, { scopePath: "app/cart" }));
    await slate.append(createEvent(1, { scopePath: "app/checkout/cart" }));
    await slate.append(
      createEvent(2, {
        scopePath: "app/profile",
        type: "profile:user:updated",
      }),
    );

    const matched: string[] = [];
    for await (const event of slate.getJournal({
      scopePath: "app/checkout",
      fromSequence: 1,
      predicate: (candidate) => candidate.type.startsWith("cart:"),
    })) {
      matched.push(event.type);
    }

    expect(matched).toEqual(["cart:item:added"]);
  });

  it("assigns a sequence when append receives a pending core placeholder sequence", async () => {
    const slate = new BluSlate();

    slate.registerProjection<number>({
      name: "cart-count",
      authority: "projection-authoritative",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "cart:item:added" ? state + 1 : state,
    });

    await slate.append(
      createEvent(-1, { eventId: "01HTESTPENDING000000000001" }),
    );
    await slate.append(
      createEvent(-1, { eventId: "01HTESTPENDING000000000002" }),
    );

    const sequences: number[] = [];
    for await (const event of slate.getJournal()) {
      sequences.push(event.sequence);
    }

    expect(sequences).toEqual([0, 1]);
    expect(slate.getProjection<number>("cart-count")).toBe(2);
  });

  it("deduplicates repeated event ids silently", async () => {
    const slate = new BluSlate();

    slate.registerProjection<number>({
      name: "cart-count",
      authority: "projection-authoritative",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "cart:item:added" ? state + 1 : state,
    });

    const event = createEvent(0);
    await slate.append(event);
    await slate.append(event);

    expect(slate.getProjection<number>("cart-count")).toBe(1);

    const journal: BluEvent[] = [];
    for await (const entry of slate.getJournal()) {
      journal.push(entry);
    }
    expect(journal).toHaveLength(1);
  });
});
