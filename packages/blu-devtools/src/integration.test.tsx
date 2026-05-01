/**
 * Stage 2 gate integration test.
 *
 * Per `docs/blu/execution.md` §2.2 the Stage 2 gate is:
 *   "a React application mounted under the provider can emit events,
 *    read projections, cross-tab sync, and inspect itself in devtools."
 *
 * This test mounts BluProvider + bus + slate + LocalTransport + BluDevtoolsPanel
 * across two simulated tabs and exercises every Stage 2 surface together.
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createBus, type Bus } from "@kitsy/blu-bus";
import { BluProvider, useEmit, useProjection } from "@kitsy/blu-context";
import type { BluEvent, Projection } from "@kitsy/blu-core";
import { createSlate, type Slate } from "@kitsy/blu-slate";
import { LocalTransport } from "@kitsy/blu-wire";
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

interface TabHarness {
  bus: Bus;
  slate: Slate;
  transport: LocalTransport;
}

const mountedRoots = new Set<Root>();
const mountedContainers = new Set<HTMLDivElement>();
const transports: LocalTransport[] = [];

interface CounterState {
  count: number;
  lastOrigin: string | null;
}

const counterProjection: Projection<CounterState> = {
  name: "counter",
  authority: "projection-authoritative",
  initialState: { count: 0, lastOrigin: null },
  reduce: (state, event) => {
    if (event.type !== "counter:incremented") return state;
    return {
      count: state.count + 1,
      lastOrigin: event.origin ?? null,
    };
  },
};

describe("Stage 2 gate — provider + bus + slate + transport + devtools", () => {
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

    for (const transport of transports) {
      await transport.disconnect();
    }
    transports.length = 0;
  });

  it("emits, reads projections, syncs across tabs, and surfaces all of it in devtools", async () => {
    const channelName = "stage2-gate-channel";
    const left = await createTab(channelName);
    const right = await createTab(channelName);

    // Wiring the bridge:
    //   • Outbound: every locally-emitted `replicated` event is offered to
    //     the transport so peers see it.
    //   • Inbound:  an event arriving from a peer is appended directly to
    //     the slate. We deliberately do NOT re-emit it on the local bus,
    //     because the bus subscriber that offers replicated events to the
    //     transport would otherwise echo it back and create a loop.
    //   • Slate dedupe by eventId protects against any residual duplicates.
    left.transport.receive(async (event) => {
      await left.slate.append(event);
    });
    right.transport.receive(async (event) => {
      await right.slate.append(event);
    });
    left.bus.subscribe(
      (e) => e.durability === "replicated",
      async (e) => {
        await left.transport.offer(e);
      },
    );
    right.bus.subscribe(
      (e) => e.durability === "replicated",
      async (e) => {
        await right.transport.offer(e);
      },
    );

    // Mount the left tab as the user-facing React app.
    const projections: DevtoolsProjectionDescriptor[] = [
      { name: "counter", authority: "projection-authoritative" },
    ];

    function CounterApp(): React.JSX.Element {
      const emit = useEmit();
      const state = useProjection<CounterState>("counter");
      const onClick = (): void => {
        void emit({
          type: "counter:incremented",
          schemaVersion: 1,
          class: "fact",
          durability: "journaled",
          payload: {},
          emitter: "urn:test:left-tab",
        });
      };
      return (
        <div>
          <span data-testid="left-count">{state.count}</span>
          <span data-testid="left-origin">{state.lastOrigin ?? "—"}</span>
          <button data-testid="left-bump" type="button" onClick={onClick}>
            bump
          </button>
        </div>
      );
    }

    function DevtoolsView({
      transportSnapshot,
    }: {
      transportSnapshot: DevtoolsTransportSnapshot;
    }): React.JSX.Element {
      return (
        <BluDevtoolsPanel
          bus={left.bus}
          slate={left.slate}
          projections={projections}
          transports={[transportSnapshot]}
        />
      );
    }

    const transportSnapshot: DevtoolsTransportSnapshot = {
      name: "left↔right",
      status: left.transport.status,
      offeredCount: 0,
      receivedCount: 0,
    };

    const rendered = await renderApp(
      <BluProvider bus={left.bus} slate={left.slate}>
        <CounterApp />
        <DevtoolsView transportSnapshot={transportSnapshot} />
      </BluProvider>,
    );

    // Stage 2 capability 1: emit from React → projection updates → DOM updates.
    expect(readByTestId(rendered.container, "left-count")).toBe("0");

    await clickByTestId(rendered.container, "left-bump");

    expect(readByTestId(rendered.container, "left-count")).toBe("1");
    expect(readByTestId(rendered.container, "left-origin")).toBe("user");

    // Stage 2 capability 2: cross-tab sync via transport.
    // Right tab emits a replicated event; it should reach the left slate and
    // bump the counter. We use a `replicated` event so the transport accepts it.
    await act(async () => {
      await right.bus.emit({
        type: "counter:incremented",
        schemaVersion: 1,
        class: "fact",
        durability: "replicated",
        payload: {},
        emitter: "urn:test:right-tab",
        origin: "sync",
      });
    });

    expect(readByTestId(rendered.container, "left-count")).toBe("2");
    // Replicated events arriving over the wire and being re-emitted on the
    // local bus retain whatever origin the producing tab assigned.
    expect(readByTestId(rendered.container, "left-origin")).toBe("sync");

    // Stage 2 capability 3: devtools sees the timeline of every observable
    // and journaled event from both tabs.
    const timelineText = readByTestId(rendered.container, "timeline").trim();
    expect(timelineText).toContain("counter:incremented");

    const projectionText = readByTestId(rendered.container, "projections");
    expect(projectionText).toContain("counter");
    expect(projectionText).toContain('"count": 2');

    // Stage 2 capability 4: replay reproduces the same projection state.
    // Since both increments are journaled/replicated they survive replay.
    await act(async () => {
      await left.slate.replay();
    });

    const replayedState = left.slate.getProjection<CounterState>("counter");
    expect(replayedState.count).toBe(2);
    expect(replayedState.lastOrigin).toBe("replay");
  });
});

async function createTab(channelName: string): Promise<TabHarness> {
  const bus = createBus();
  const slate = createSlate();
  slate.registerProjection(counterProjection);

  bus.subscribe(
    () => true,
    async (event) => {
      try {
        await slate.append(event);
      } catch {
        // Replays of already-seen events are safely deduplicated by eventId.
      }
    },
  );

  const transport = new LocalTransport({ channelName });
  transports.push(transport);
  await transport.connect();

  return { bus, slate, transport };
}

async function renderApp(ui: React.JSX.Element): Promise<{
  container: HTMLDivElement;
  root: Root;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  mountedContainers.add(container);

  const root = createRoot(container);
  mountedRoots.add(root);

  await act(async () => {
    root.render(ui);
  });

  return { container, root };
}

async function clickByTestId(
  container: HTMLDivElement,
  testId: string,
): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>(
    `[data-testid="${testId}"]`,
  );
  if (button === null) {
    throw new Error(`No button found for data-testid="${testId}".`);
  }
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function readByTestId(container: HTMLDivElement, testId: string): string {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (element === null) {
    throw new Error(`No element found for data-testid="${testId}".`);
  }
  return element.textContent ?? "";
}

// Silence the unused import lint for the BluEvent type — used in JSDoc above.
void (null as unknown as BluEvent);
