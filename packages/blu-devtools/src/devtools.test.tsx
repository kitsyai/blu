import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createBus, type Bus } from "@kitsy/blu-bus";
import type { BluEvent, PartialEvent, Projection } from "@kitsy/blu-core";
import { createSlate, type Slate } from "@kitsy/blu-slate";
import {
  BluDevtoolsPanel,
  type DevtoolsProjectionDescriptor,
  type DevtoolsTransportSnapshot,
} from "./devtools.js";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

interface RuntimeHarness {
  bus: Bus;
  slate: Slate;
}

interface RenderHarness {
  container: HTMLDivElement;
  root: Root;
  unmount: () => Promise<void>;
}

const mountedRoots = new Set<Root>();
const mountedContainers = new Set<HTMLDivElement>();

describe("@kitsy/blu-devtools", () => {
  afterEach(async () => {
    for (const root of mountedRoots) {
      await act(async () => {
        root.unmount();
      });
    }
    mountedRoots.clear();

    for (const container of mountedContainers) {
      container.remove();
    }
    mountedContainers.clear();
  });

  it("renders every observable-or-higher event in order and shows transport throughput", async () => {
    const runtime = createRuntimeHarness();

    const transports: DevtoolsTransportSnapshot[] = [
      {
        name: "broadcast-channel",
        status: "connected",
        offeredCount: 3,
        receivedCount: 2,
        errorCount: 1,
        lastEventType: "orders:submitted",
      },
    ];

    const rendered = await renderApp(
      <BluDevtoolsPanel
        bus={runtime.bus}
        slate={runtime.slate}
        transports={transports}
      />,
    );

    await emitEvent(runtime.bus, {
      type: "debug:blink",
      schemaVersion: 1,
      class: "fact",
      durability: "ephemeral",
      payload: {},
      emitter: "urn:test:debug",
    });
    await emitEvent(runtime.bus, {
      type: "orders:viewed",
      schemaVersion: 1,
      class: "fact",
      durability: "observable",
      payload: {},
      emitter: "urn:test:orders",
    });
    await emitEvent(runtime.bus, {
      type: "orders:submitted",
      schemaVersion: 1,
      class: "fact",
      durability: "journaled",
      payload: {},
      emitter: "urn:test:orders",
    });
    await emitEvent(runtime.bus, {
      type: "orders:replicated",
      schemaVersion: 1,
      class: "sync",
      durability: "replicated",
      payload: {},
      emitter: "urn:test:orders",
      origin: "sync",
    });

    expect(readTimeline(rendered.container)).toEqual([
      "#1 orders:viewed [fact/observable]",
      "#2 orders:submitted [fact/journaled]",
      "#3 orders:replicated [sync/replicated]",
    ]);

    const transportText = rendered.container.querySelector(
      '[data-testid="transports"]',
    )?.textContent;
    expect(transportText).toContain("broadcast-channel");
    expect(transportText).toContain("connected");
    expect(transportText).toContain("offered=3 received=2 errors=1");
    expect(transportText).toContain("last=orders:submitted");
  });

  it("traces causal parents and descendants for a selected event", async () => {
    const runtime = createRuntimeHarness();

    runtime.bus.subscribe("cart:item:add-requested", async () => {
      await runtime.bus.emit({
        type: "cart:item:added",
        schemaVersion: 1,
        class: "fact",
        durability: "journaled",
        payload: { sku: "sku-1" },
        emitter: "urn:test:cart",
      });
    });

    runtime.bus.subscribe("cart:item:added", async () => {
      await runtime.bus.emit({
        type: "inventory:reserved",
        schemaVersion: 1,
        class: "fact",
        durability: "journaled",
        payload: { sku: "sku-1" },
        emitter: "urn:test:inventory",
      });
    });

    const rendered = await renderApp(
      <BluDevtoolsPanel bus={runtime.bus} slate={runtime.slate} />,
    );

    await emitEvent(runtime.bus, {
      type: "cart:item:add-requested",
      schemaVersion: 1,
      class: "intent",
      durability: "journaled",
      payload: { sku: "sku-1" },
      emitter: "urn:test:user",
    });

    await clickTimelineItem(rendered.container, "cart:item:added");

    expect(readByTestId(rendered.container, "selected-event")).toContain(
      "cart:item:added",
    );
    expect(readByTestId(rendered.container, "ancestors")).toContain(
      "cart:item:add-requested",
    );
    expect(readByTestId(rendered.container, "descendants")).toContain(
      "inventory:reserved",
    );
  });

  it("refreshes projection inspection after replay", async () => {
    const runtime = createRuntimeHarness();

    registerProjection(runtime.slate, {
      name: "counter",
      authority: "projection-authoritative",
      initialState: {
        count: 0,
        lastOrigin: null,
      },
      reduce: (state, event) =>
        event.type === "counter:incremented"
          ? {
              count: state.count + 1,
              lastOrigin: event.origin,
            }
          : state,
    });

    const projections: DevtoolsProjectionDescriptor[] = [
      {
        name: "counter",
        authority: "projection-authoritative",
      },
    ];

    const rendered = await renderApp(
      <BluDevtoolsPanel
        bus={runtime.bus}
        slate={runtime.slate}
        projections={projections}
      />,
    );

    await emitEvent(runtime.bus, {
      type: "counter:incremented",
      schemaVersion: 1,
      class: "fact",
      durability: "journaled",
      payload: {},
      emitter: "urn:test:counter",
    });

    expect(readProjectionState(rendered.container, "counter")).toContain(
      '"count": 1',
    );
    expect(readProjectionState(rendered.container, "counter")).toContain(
      '"lastOrigin": "user"',
    );

    await act(async () => {
      await runtime.slate.replay();
    });

    expect(readProjectionState(rendered.container, "counter")).toContain(
      '"count": 1',
    );
    expect(readProjectionState(rendered.container, "counter")).toContain(
      '"lastOrigin": "replay"',
    );
  });
});

function createRuntimeHarness(): RuntimeHarness {
  const bus = createBus();
  const slate = createSlate();

  bus.subscribe(
    () => true,
    async (event) => {
      await slate.append(event);
    },
  );

  return { bus, slate };
}

function registerProjection<T>(slate: Slate, projection: Projection<T>): void {
  slate.registerProjection(projection);
}

async function emitEvent<T>(
  bus: Bus,
  event: PartialEvent<T>,
): Promise<BluEvent<T>> {
  let emitted: BluEvent<T>;

  await act(async () => {
    emitted = await bus.emit(event);
  });

  return emitted!;
}

async function renderApp(ui: React.JSX.Element): Promise<RenderHarness> {
  const container = document.createElement("div");
  document.body.append(container);
  mountedContainers.add(container);

  const root = createRoot(container);
  mountedRoots.add(root);

  await act(async () => {
    root.render(ui);
  });

  return {
    container,
    root,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      mountedRoots.delete(root);
      container.remove();
      mountedContainers.delete(container);
    },
  };
}

function readTimeline(container: HTMLDivElement): string[] {
  return Array.from(
    container.querySelectorAll('[data-testid="timeline-item"]'),
  ).map((element) => element.textContent ?? "");
}

async function clickTimelineItem(
  container: HTMLDivElement,
  eventType: string,
): Promise<void> {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="timeline-item"]',
    ),
  ).find((candidate) => candidate.textContent?.includes(eventType));
  if (button === undefined) {
    throw new Error(`Timeline item for "${eventType}" not found.`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function readProjectionState(
  container: HTMLDivElement,
  projectionName: string,
): string {
  const projectionList = container.querySelector('[data-testid="projections"]');
  if (projectionList === null) {
    throw new Error("Projection list not found.");
  }

  const item = Array.from(projectionList.querySelectorAll("li")).find((entry) =>
    entry.textContent?.includes(projectionName),
  );
  if (item === undefined) {
    throw new Error(`Projection "${projectionName}" not found.`);
  }

  const state = item.querySelector('[data-testid="projection-state"]');
  if (state === null) {
    throw new Error(`Projection state for "${projectionName}" not found.`);
  }

  return state.textContent ?? "";
}

function readByTestId(container: HTMLDivElement, testId: string): string {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (element === null) {
    throw new Error(`No element found for data-testid="${testId}".`);
  }
  return element.textContent ?? "";
}
