import React, { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BluProvider } from "@kitsy/blu-context";
import { createBus, type Bus } from "@kitsy/blu-bus";
import type { BluEvent, PartialEvent, Projection } from "@kitsy/blu-core";
import type { ComponentMeta, ViewNode } from "@kitsy/blu-schema";
import { createSlate, type Slate } from "@kitsy/blu-slate";
import { ComponentRegistry, View, createComponentRegistry } from "./view.js";

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
let tokenSequence = 0;

describe("@kitsy/blu-view", () => {
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
    tokenSequence = 0;
  });

  it("renders a static ViewNode tree identically to equivalent JSX", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();
    const node: ViewNode = {
      component: "urn:blu:test:box",
      props: {
        title: "Hello",
      },
      children: [
        {
          component: "urn:blu:test:text",
          props: {
            value: "World",
          },
        },
      ],
    };

    const renderedView = await renderRuntimeView(runtime, registry, node);
    const renderedJsx = await renderApp(
      <TestBox title="Hello">
        <TestText value="World" />
      </TestBox>,
    );

    expect(renderedView.container.innerHTML).toBe(
      renderedJsx.container.innerHTML,
    );
  });

  it("reads bindings from projections and re-renders on event-driven updates", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();

    registerProjection(runtime.slate, {
      name: "greeting",
      authority: "projection-authoritative",
      initialState: {
        text: "hello",
      },
      reduce: (state, event) =>
        event.type === "greeting:updated"
          ? { text: String((event.payload as { text: string }).text) }
          : state,
    });

    const node: ViewNode = {
      component: "urn:blu:test:text",
      props: {
        value: { $bind: "greeting.text" },
      },
    };

    const rendered = await renderRuntimeView(runtime, registry, node);
    expect(rendered.container.textContent).toContain("hello");

    await emitFact(runtime.bus, "greeting:updated", { text: "hi" });
    expect(rendered.container.textContent).toContain("hi");
  });

  it("evaluates conditions and toggles rendering from projection changes", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();

    registerProjection(runtime.slate, {
      name: "session",
      authority: "projection-authoritative",
      initialState: {
        loggedIn: false,
        role: "guest",
      },
      reduce: (state, event) =>
        event.type === "session:updated"
          ? {
              loggedIn: Boolean(
                (event.payload as { loggedIn: boolean }).loggedIn,
              ),
              role: String((event.payload as { role: string }).role),
            }
          : state,
    });

    const node: ViewNode = {
      component: "urn:blu:test:text",
      props: {
        value: "secret",
      },
      when: {
        $and: [
          { $truthy: { $bind: "session.loggedIn" } },
          { $eq: [{ $bind: "session.role" }, "admin"] },
        ],
      },
    };

    const rendered = await renderRuntimeView(runtime, registry, node);
    expect(rendered.container.textContent).toBe("");

    await emitFact(runtime.bus, "session:updated", {
      loggedIn: true,
      role: "admin",
    });
    expect(rendered.container.textContent).toContain("secret");
  });

  it("uses repeat keys to preserve component identity across reordering", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();

    registerProjection(runtime.slate, {
      name: "items",
      authority: "projection-authoritative",
      initialState: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      reduce: (state, event) =>
        event.type === "items:reordered"
          ? (event.payload as { items: Array<{ id: string; label: string }> })
              .items
          : state,
    });

    const node: ViewNode = {
      component: "urn:blu:test:token",
      props: {
        label: { $bind: "row.label" },
      },
      repeat: {
        over: {
          source: "projection",
          path: "items",
        },
        as: "row",
        key: "id",
      },
    };

    const rendered = await renderRuntimeView(runtime, registry, node);
    expect(readLines(rendered.container, '[data-testid="token"]')).toEqual([
      "A:1",
      "B:2",
    ]);

    await emitFact(runtime.bus, "items:reordered", {
      items: [
        { id: "b", label: "B" },
        { id: "a", label: "A" },
      ],
    });

    expect(readLines(rendered.container, '[data-testid="token"]')).toEqual([
      "B:2",
      "A:1",
    ]);
  });

  it("renders a labeled unknown-URN fallback in development and nothing in production", async () => {
    const runtime = createRuntimeHarness();
    const registry = new ComponentRegistry();
    const node: ViewNode = {
      component: "urn:blu:test:missing",
    };

    const previous = process.env.NODE_ENV;

    process.env.NODE_ENV = "development";
    const devRendered = await renderRuntimeView(runtime, registry, node);
    expect(devRendered.container.textContent).toContain("Unknown component");

    await devRendered.unmount();

    process.env.NODE_ENV = "production";
    const prodRendered = await renderRuntimeView(runtime, registry, node);
    expect(prodRendered.container.innerHTML).toBe("");

    process.env.NODE_ENV = previous;
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

function createTestRegistry(): ComponentRegistry {
  const registry = createComponentRegistry();

  registry.register(
    "urn:blu:test:box",
    TestBox,
    createMeta("urn:blu:test:box"),
  );
  registry.register(
    "urn:blu:test:text",
    TestText,
    createMeta("urn:blu:test:text"),
  );
  registry.register(
    "urn:blu:test:token",
    TokenComponent,
    createMeta("urn:blu:test:token"),
  );

  return registry;
}

function createMeta(urn: string): ComponentMeta {
  return {
    urn,
    displayName: urn,
    description: urn,
    category: "primitive",
    version: "1.0.0",
    props: {
      type: "object",
      properties: {},
    },
  };
}

function TestBox({
  title,
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section data-testid="box">
      <h1>{title}</h1>
      <div>{children}</div>
    </section>
  );
}

function TestText({ value }: { value?: unknown }): React.JSX.Element {
  return <span data-testid="text">{String(value ?? "")}</span>;
}

function TokenComponent({ label }: { label?: unknown }): React.JSX.Element {
  const [token] = useState(() => {
    tokenSequence += 1;
    return tokenSequence;
  });

  return (
    <span data-testid="token">
      {String(label ?? "")}:{token}
    </span>
  );
}

function registerProjection<T>(slate: Slate, projection: Projection<T>): void {
  slate.registerProjection(projection);
}

async function renderRuntimeView(
  runtime: RuntimeHarness,
  registry: ComponentRegistry,
  node: ViewNode,
): Promise<RenderHarness> {
  return renderApp(
    <BluProvider bus={runtime.bus} slate={runtime.slate}>
      <View node={node} registry={registry} />
    </BluProvider>,
  );
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

async function emitFact(
  bus: Bus,
  type: string,
  payload: Record<string, unknown>,
): Promise<BluEvent<Record<string, unknown>>> {
  let emitted!: BluEvent<Record<string, unknown>>;

  await act(async () => {
    emitted = await bus.emit({
      type,
      schemaVersion: 1,
      class: "fact",
      durability: "journaled",
      payload,
      emitter: "urn:test:view",
    });
  });

  return emitted;
}

function readLines(container: HTMLDivElement, selector: string): string[] {
  return Array.from(container.querySelectorAll(selector)).map(
    (element) => element.textContent ?? "",
  );
}
