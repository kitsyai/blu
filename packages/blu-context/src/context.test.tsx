import React, { memo } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Bus,
  createBus,
  type EventFilter,
  type BusHandler,
  type BusMiddleware,
} from "@kitsy/blu-bus";
import type { BluEvent, PartialEvent, Projection } from "@kitsy/blu-core";
import { createSlate, type JournalFilter, type Slate } from "@kitsy/blu-slate";
import {
  BluProvider,
  type DataSourceState,
  type FormState,
  useRoute,
  useBus,
  useDataSource,
  useEmit,
  useEventSubscription,
  useForm,
  useProjection,
  useSlate,
} from "./context.js";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

interface RuntimeHarness {
  bus: Bus;
  slate: Slate;
}

interface InstrumentedBus {
  bus: Bus;
  stats: {
    subscribed: number;
    unsubscribed: number;
    active: number;
  };
}

interface InstrumentedSlate {
  slate: Slate;
  stats: {
    subscribed: number;
    unsubscribed: number;
    active: number;
  };
}

interface RenderHarness {
  container: HTMLDivElement;
  root: Root;
  unmount: () => Promise<void>;
}

const mountedRoots = new Set<Root>();
const mountedContainers = new Set<HTMLDivElement>();

describe("@kitsy/blu-context", () => {
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

  it("wires provider hooks so React components can emit, read projections, and react to events", async () => {
    const runtime = createRuntimeHarness();
    registerProjection<number>(runtime.slate, {
      name: "count",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "counter:incremented"
          ? state + Number((event.payload as { amount?: number }).amount ?? 1)
          : state,
    });
    registerProjection<DataSourceState<string[]>>(runtime.slate, {
      name: "data:users",
      initialState: {
        status: "idle",
        data: null,
        error: null,
      },
      reduce: (state, event) =>
        event.type === "users:loaded"
          ? {
              status: "loaded",
              data: (event.payload as { users: string[] }).users,
              error: null,
              fetchedAt: 123,
            }
          : state,
    });

    function App(): React.JSX.Element {
      const bus = useBus();
      const slate = useSlate();
      const emit = useEmit();
      const count = useProjection<number>("count");
      const users = useDataSource<string[]>("data:users");
      const [seenTypes, setSeenTypes] = React.useState<string[]>([]);

      useEventSubscription("counter:*", (event) => {
        setSeenTypes((current) => [...current, event.type]);
      });

      return (
        <div>
          <span data-testid="runtime">
            {bus === runtime.bus && slate === runtime.slate ? "ready" : "bad"}
          </span>
          <span data-testid="count">{String(count)}</span>
          <span data-testid="users-status">{users.status}</span>
          <span data-testid="users-count">
            {String(users.data?.length ?? 0)}
          </span>
          <span data-testid="seen">{seenTypes.join(",")}</span>
          <button
            type="button"
            onClick={() => {
              void emit({
                type: "counter:incremented",
                schemaVersion: 1,
                class: "fact",
                durability: "journaled",
                payload: { amount: 2 },
                emitter: "urn:test:button",
              });
              void emit({
                type: "users:loaded",
                schemaVersion: 1,
                class: "fact",
                durability: "journaled",
                payload: { users: ["Ada", "Grace"] },
                emitter: "urn:test:button",
              });
            }}
          >
            emit
          </button>
        </div>
      );
    }

    const rendered = await renderApp(
      <BluProvider bus={runtime.bus} slate={runtime.slate}>
        <App />
      </BluProvider>,
    );

    expect(readByTestId(rendered.container, "runtime")).toBe("ready");
    expect(readByTestId(rendered.container, "count")).toBe("0");
    expect(readByTestId(rendered.container, "users-status")).toBe("idle");
    expect(readByTestId(rendered.container, "users-count")).toBe("0");

    await click(rendered.container, "emit");

    expect(readByTestId(rendered.container, "count")).toBe("2");
    expect(readByTestId(rendered.container, "users-status")).toBe("loaded");
    expect(readByTestId(rendered.container, "users-count")).toBe("2");
    expect(readByTestId(rendered.container, "seen")).toBe(
      "counter:incremented",
    );
  });

  it("re-renders projection consumers only when the consumed projection changes", async () => {
    const runtime = createRuntimeHarness();
    registerProjection<number>(runtime.slate, {
      name: "count",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "counter:incremented" ? state + 1 : state,
    });
    registerProjection<string>(runtime.slate, {
      name: "status",
      initialState: "idle",
      reduce: (state, event) =>
        event.type === "status:updated"
          ? String((event.payload as { value: string }).value)
          : state,
    });

    let countRenders = 0;

    function CounterView(): React.JSX.Element {
      countRenders += 1;
      const count = useProjection<number>("count");
      return <span data-testid="count">{String(count)}</span>;
    }

    const rendered = await renderApp(
      <BluProvider bus={runtime.bus} slate={runtime.slate}>
        <CounterView />
      </BluProvider>,
    );

    expect(readByTestId(rendered.container, "count")).toBe("0");
    expect(countRenders).toBe(1);

    await emitFact(runtime.bus, "status:updated", { value: "busy" });
    expect(countRenders).toBe(1);

    await emitFact(runtime.bus, "counter:incremented");
    expect(readByTestId(rendered.container, "count")).toBe("1");
    expect(countRenders).toBe(2);
  });

  it("does not force memoized child re-renders when a parent reads a different projection", async () => {
    const runtime = createRuntimeHarness();
    registerProjection<number>(runtime.slate, {
      name: "count",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "counter:incremented" ? state + 1 : state,
    });
    registerProjection<string>(runtime.slate, {
      name: "status",
      initialState: "idle",
      reduce: (state, event) =>
        event.type === "status:updated"
          ? String((event.payload as { value: string }).value)
          : state,
    });

    let parentRenders = 0;
    let childRenders = 0;

    const Child = memo(function Child(): React.JSX.Element {
      childRenders += 1;
      const status = useProjection<string>("status");
      return <span data-testid="status">{status}</span>;
    });

    function Parent(): React.JSX.Element {
      parentRenders += 1;
      const count = useProjection<number>("count");
      return (
        <div>
          <span data-testid="count">{String(count)}</span>
          <Child />
        </div>
      );
    }

    const rendered = await renderApp(
      <BluProvider bus={runtime.bus} slate={runtime.slate}>
        <Parent />
      </BluProvider>,
    );

    expect(parentRenders).toBe(1);
    expect(childRenders).toBe(1);

    await emitFact(runtime.bus, "counter:incremented");
    expect(readByTestId(rendered.container, "count")).toBe("1");
    expect(parentRenders).toBe(2);
    expect(childRenders).toBe(1);

    await emitFact(runtime.bus, "status:updated", { value: "ready" });
    expect(readByTestId(rendered.container, "status")).toBe("ready");
    expect(parentRenders).toBe(2);
    expect(childRenders).toBe(2);
  });

  it("cleans up bus and slate subscriptions on unmount", async () => {
    const instrumentedBus = createInstrumentedBus();
    const instrumentedSlate = createInstrumentedSlate();

    registerProjection<number>(instrumentedSlate.slate, {
      name: "count",
      initialState: 0,
      reduce: (state, event) =>
        event.type === "counter:incremented" ? state + 1 : state,
    });

    function App(): React.JSX.Element {
      useProjection<number>("count");
      useEventSubscription("counter:*", () => {});
      return <div data-testid="state">mounted</div>;
    }

    const rendered = await renderApp(
      <BluProvider bus={instrumentedBus.bus} slate={instrumentedSlate.slate}>
        <App />
      </BluProvider>,
    );

    expect(readByTestId(rendered.container, "state")).toBe("mounted");
    expect(instrumentedBus.stats.active).toBe(1);
    expect(instrumentedSlate.stats.active).toBe(1);

    await rendered.unmount();

    expect(instrumentedBus.stats.active).toBe(0);
    expect(instrumentedSlate.stats.active).toBe(0);
    expect(instrumentedBus.stats.unsubscribed).toBe(1);
    expect(instrumentedSlate.stats.unsubscribed).toBe(1);
  });

  it("uses the nearest provider when contexts are nested", async () => {
    const outer = createRuntimeHarness();
    const inner = createRuntimeHarness();

    registerProjection<number>(outer.slate, {
      name: "count",
      initialState: 1,
      reduce: (state) => state,
    });
    registerProjection<number>(inner.slate, {
      name: "count",
      initialState: 9,
      reduce: (state) => state,
    });

    function OuterView(): React.JSX.Element {
      const count = useProjection<number>("count");
      const bus = useBus();
      return (
        <div>
          <span data-testid="outer-count">{String(count)}</span>
          <span data-testid="outer-bus">
            {bus === outer.bus ? "outer" : "wrong"}
          </span>
          <BluProvider bus={inner.bus} slate={inner.slate}>
            <InnerView />
          </BluProvider>
        </div>
      );
    }

    function InnerView(): React.JSX.Element {
      const count = useProjection<number>("count");
      const slate = useSlate();
      return (
        <div>
          <span data-testid="inner-count">{String(count)}</span>
          <span data-testid="inner-slate">
            {slate === inner.slate ? "inner" : "wrong"}
          </span>
        </div>
      );
    }

    const rendered = await renderApp(
      <BluProvider bus={outer.bus} slate={outer.slate}>
        <OuterView />
      </BluProvider>,
    );

    expect(readByTestId(rendered.container, "outer-count")).toBe("1");
    expect(readByTestId(rendered.container, "outer-bus")).toBe("outer");
    expect(readByTestId(rendered.container, "inner-count")).toBe("9");
    expect(readByTestId(rendered.container, "inner-slate")).toBe("inner");
  });

  it("exposes a projection-backed form handle that emits standard form events", async () => {
    const runtime = createRuntimeHarness();

    registerProjection<FormState>(runtime.slate, {
      name: "form:signup",
      initialState: {
        values: {
          email: "",
        },
        errors: {},
        formErrors: [],
        valid: true,
        touched: {},
        submitting: false,
        submitCount: 0,
      },
      reduce: (state, event) => {
        if (event.type === "form:signup:field-set") {
          const payload = event.payload as { field: string; value: unknown };
          return {
            ...state,
            values: {
              ...state.values,
              [payload.field]: payload.value,
            },
          };
        }
        if (event.type === "form:signup:reset") {
          return {
            ...state,
            values: {
              email: "",
            },
          };
        }
        return state;
      },
    });

    function App(): React.JSX.Element {
      const form = useForm("signup");

      return (
        <div>
          <span data-testid="email">{String(form.values.email ?? "")}</span>
          <button
            type="button"
            onClick={() => {
              void form.setField("email", "ada@example.com");
            }}
          >
            fill
          </button>
          <button
            type="button"
            onClick={() => {
              void form.reset();
            }}
          >
            reset
          </button>
        </div>
      );
    }

    const rendered = await renderApp(
      <BluProvider bus={runtime.bus} slate={runtime.slate}>
        <App />
      </BluProvider>,
    );

    expect(readByTestId(rendered.container, "email")).toBe("");

    await click(rendered.container, "fill");
    expect(readByTestId(rendered.container, "email")).toBe("ada@example.com");

    await click(rendered.container, "reset");
    expect(readByTestId(rendered.container, "email")).toBe("");
  });

  it("reads the shared route projection through useRoute", async () => {
    const runtime = createRuntimeHarness();
    registerProjection(runtime.slate, {
      name: "route:current",
      initialState: {
        mode: "history",
        path: "/",
        params: {},
        meta: {
          title: "Home",
        },
        matched: true,
      },
      reduce: (state, event) =>
        event.type === "router:navigated"
          ? {
              ...state,
              path: String((event.payload as { path: string }).path),
              meta: {
                title: String(
                  (event.payload as { meta?: { title?: string } }).meta
                    ?.title ?? "",
                ),
              },
            }
          : state,
    });

    function App(): React.JSX.Element {
      const route = useRoute();
      return (
        <div>
          <span data-testid="route-path">{route.path}</span>
          <span data-testid="route-title">
            {String(route.meta.title ?? "")}
          </span>
        </div>
      );
    }

    const rendered = await renderApp(
      <BluProvider bus={runtime.bus} slate={runtime.slate}>
        <App />
      </BluProvider>,
    );

    expect(readByTestId(rendered.container, "route-path")).toBe("/");
    expect(readByTestId(rendered.container, "route-title")).toBe("Home");

    await emitFact(runtime.bus, "router:navigated", {
      path: "/settings",
      meta: { title: "Settings" },
    });

    expect(readByTestId(rendered.container, "route-path")).toBe("/settings");
    expect(readByTestId(rendered.container, "route-title")).toBe("Settings");
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

function createInstrumentedBus(): InstrumentedBus {
  const base = createBus();
  const stats = {
    subscribed: 0,
    unsubscribed: 0,
    active: 0,
  };

  const bus: Bus = {
    emit<T>(event: PartialEvent<T>): Promise<BluEvent<T>> {
      return base.emit(event);
    },
    subscribe(filter: EventFilter, handler: BusHandler) {
      stats.subscribed += 1;
      stats.active += 1;
      const unsubscribe = base.subscribe(filter, handler);
      return () => {
        stats.unsubscribed += 1;
        stats.active -= 1;
        unsubscribe();
      };
    },
    use(middleware: BusMiddleware): void {
      base.use(middleware);
    },
  };

  return { bus, stats };
}

function createInstrumentedSlate(): InstrumentedSlate {
  const base = createSlate();
  const stats = {
    subscribed: 0,
    unsubscribed: 0,
    active: 0,
  };

  const slate: Slate = {
    registerProjection: base.registerProjection.bind(base),
    registerDerivedProjection: base.registerDerivedProjection.bind(base),
    unregisterProjection: base.unregisterProjection.bind(base),
    getProjection: base.getProjection.bind(base),
    subscribeProjection<T>(name: string, listener: (state: T) => void) {
      stats.subscribed += 1;
      stats.active += 1;
      const unsubscribe = base.subscribeProjection(name, listener);
      return () => {
        stats.unsubscribed += 1;
        stats.active -= 1;
        unsubscribe();
      };
    },
    append: base.append.bind(base),
    getJournal(filter?: JournalFilter) {
      return base.getJournal(filter);
    },
    snapshot: base.snapshot.bind(base),
    compact: base.compact.bind(base),
    replay: base.replay.bind(base),
  };

  return { slate, stats };
}

function registerProjection<T>(
  slate: Slate,
  projection: Pick<Projection<T>, "name" | "initialState" | "reduce">,
): void {
  slate.registerProjection({
    name: projection.name,
    authority: "projection-authoritative",
    initialState: projection.initialState,
    reduce: projection.reduce,
  });
}

async function emitFact(
  bus: Bus,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await act(async () => {
    await bus.emit({
      type,
      schemaVersion: 1,
      class: "fact",
      durability: "journaled",
      payload,
      emitter: "urn:test:emitter",
    });
  });
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

async function click(
  container: HTMLDivElement,
  buttonText: string,
): Promise<void> {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === buttonText,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button "${buttonText}" not found.`);
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
