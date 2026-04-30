import React, { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BluProvider } from "@kitsy/blu-context";
import { createBus, type Bus } from "@kitsy/blu-bus";
import type { BluEvent, PartialEvent, Projection } from "@kitsy/blu-core";
import type {
  ComponentMeta,
  DataSourceRegistration,
  FormDefinition,
  ViewNode,
} from "@kitsy/blu-schema";
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

  it("compiles emit actions and emits the resolved event payload on click", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();
    const seen: BluEvent[] = [];

    registerProjection(runtime.slate, {
      name: "session",
      authority: "projection-authoritative",
      initialState: {
        userId: "user-42",
      },
      reduce: (state) => state,
    });

    runtime.bus.subscribe("cart:item:add-requested", (event) => {
      seen.push(event);
    });

    const node: ViewNode = {
      component: "urn:blu:test:button",
      props: {
        label: "Add",
      },
      actions: {
        onClick: {
          kind: "emit",
          type: "cart:item:add-requested",
          class: "fact",
          durability: "journaled",
          payload: {
            userId: { $bind: "session.userId" },
            sku: "sku-1",
          },
        },
      },
    };

    const rendered = await renderRuntimeView(runtime, registry, node);
    await clickByTestId(rendered.container, "button");

    expect(seen).toHaveLength(1);
    expect(seen[0]?.payload).toEqual({
      userId: "user-42",
      sku: "sku-1",
    });
  });

  it("runs composite actions sequentially and resolves navigate actions", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();
    const seen: string[] = [];
    const navigations: string[] = [];

    runtime.bus.subscribe("metrics:clicked", () => {
      seen.push("metrics:clicked");
    });

    const node: ViewNode = {
      component: "urn:blu:test:button",
      props: {
        label: "Continue",
      },
      actions: {
        onClick: {
          kind: "composite",
          steps: [
            {
              kind: "emit",
              type: "metrics:clicked",
              class: "fact",
              durability: "journaled",
            },
            {
              kind: "navigate",
              to: "/checkout",
            },
          ],
        },
      },
    };

    const rendered = await renderRuntimeView(runtime, registry, node, {
      onNavigate: async (to) => {
        navigations.push(to);
      },
    });
    await clickByTestId(rendered.container, "button");

    expect(seen).toEqual(["metrics:clicked"]);
    expect(navigations).toEqual(["/checkout"]);
  });

  it("materializes a rest data source projection and transitions through loading to loaded", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();
    let resolveFetch!: (response: Response) => void;

    const fetcher = () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

    const node: ViewNode = {
      component: "urn:blu:test:data-status",
      bindings: {
        status: {
          source: "data",
          path: "data:users.status",
        },
        count: {
          source: "data",
          path: "data:users.data.length",
          fallback: 0,
        },
      },
    };

    const rendered = await renderRuntimeView(runtime, registry, node, {
      dataSources: [
        {
          source: {
            kind: "rest",
            id: "users",
            url: "https://example.test/users",
          },
        },
      ],
      fetcher,
    });

    await waitFor(() => readByTestId(rendered.container, "data-status"), {
      expected: "loading:0",
    });

    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify(["Ada", "Grace"]), {
          headers: {
            "content-type": "application/json",
          },
        }),
      );
    });

    await waitFor(() => readByTestId(rendered.container, "data-status"), {
      expected: "loaded:2",
    });
  });

  it("mutates form fields, blocks invalid submission, and emits submitted payload once valid", async () => {
    const runtime = createRuntimeHarness();
    const registry = createTestRegistry();
    const submitted: BluEvent[] = [];

    runtime.bus.subscribe("form:signup:submitted", (event) => {
      submitted.push(event);
    });

    const forms: FormDefinition[] = [
      {
        id: "signup",
        fields: {
          email: {
            type: "text",
            required: true,
            default: "",
          },
        },
      },
    ];

    const node: ViewNode = {
      component: "urn:blu:test:box",
      children: [
        {
          component: "urn:blu:test:input",
          bindings: {
            value: {
              source: "form",
              path: "form:signup.values.email",
            },
          },
          actions: {
            onChange: {
              kind: "form",
              op: "setField",
              form: "signup",
              field: "email",
            },
          },
        },
        {
          component: "urn:blu:test:button",
          props: {
            label: "Submit",
          },
          actions: {
            onClick: {
              kind: "form",
              op: "submit",
              form: "signup",
            },
          },
        },
        {
          component: "urn:blu:test:form-status",
          bindings: {
            value: {
              source: "form",
              path: "form:signup.values.email",
            },
            errorCount: {
              source: "form",
              path: "form:signup.errors.email.length",
              fallback: 0,
            },
            valid: {
              source: "form",
              path: "form:signup.valid",
            },
          },
        },
      ],
    };

    const rendered = await renderRuntimeView(runtime, registry, node, {
      forms,
    });

    await clickByTestId(rendered.container, "button");
    await waitFor(() => readByTestId(rendered.container, "form-status"), {
      expected: "|errors=1|valid=false",
    });
    expect(submitted).toHaveLength(0);

    await changeInputByTestId(rendered.container, "input", "ada@example.com");
    await waitFor(() => readByTestId(rendered.container, "form-status"), {
      expected: "ada@example.com|errors=0|valid=true",
    });

    await clickByTestId(rendered.container, "button");
    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.payload).toEqual({
      email: "ada@example.com",
    });
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
  registry.register(
    "urn:blu:test:button",
    TestButton,
    createMeta("urn:blu:test:button"),
  );
  registry.register(
    "urn:blu:test:input",
    TestInput,
    createMeta("urn:blu:test:input"),
  );
  registry.register(
    "urn:blu:test:data-status",
    DataStatus,
    createMeta("urn:blu:test:data-status"),
  );
  registry.register(
    "urn:blu:test:form-status",
    FormStatus,
    createMeta("urn:blu:test:form-status"),
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

function TestButton({
  label,
  onClick,
}: {
  label?: unknown;
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <button data-testid="button" type="button" onClick={onClick}>
      {String(label ?? "")}
    </button>
  );
}

function TestInput({
  value,
  onChange,
}: {
  value?: unknown;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}): React.JSX.Element {
  return (
    <input
      data-testid="input"
      value={typeof value === "string" ? value : String(value ?? "")}
      onChange={onChange}
    />
  );
}

function DataStatus({
  status,
  count,
}: {
  status?: unknown;
  count?: unknown;
}): React.JSX.Element {
  return (
    <span data-testid="data-status">
      {String(status ?? "")}:{String(count ?? 0)}
    </span>
  );
}

function FormStatus({
  value,
  errorCount,
  valid,
}: {
  value?: unknown;
  errorCount?: unknown;
  valid?: unknown;
}): React.JSX.Element {
  return (
    <span data-testid="form-status">
      {String(value ?? "")}|errors={String(errorCount ?? 0)}|valid=
      {String(valid ?? "")}
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
  options: {
    dataSources?: readonly DataSourceRegistration[];
    forms?: readonly FormDefinition[];
    fetcher?: (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response>;
    onNavigate?: (
      to: string,
      options: {
        replace?: boolean;
        state?: Record<string, unknown>;
      },
    ) => void | Promise<void>;
  } = {},
): Promise<RenderHarness> {
  return renderApp(
    <BluProvider bus={runtime.bus} slate={runtime.slate}>
      <View
        node={node}
        registry={registry}
        dataSources={options.dataSources}
        forms={options.forms}
        fetcher={options.fetcher}
        onNavigate={options.onNavigate}
      />
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

function readByTestId(container: HTMLDivElement, testId: string): string {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (element === null) {
    throw new Error(`No element found for data-testid="${testId}".`);
  }
  return element.textContent ?? "";
}

async function clickByTestId(
  container: HTMLDivElement,
  testId: string,
): Promise<void> {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No clickable element found for data-testid="${testId}".`);
  }

  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function changeInputByTestId(
  container: HTMLDivElement,
  testId: string,
  value: string,
): Promise<void> {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`No input element found for data-testid="${testId}".`);
  }

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(element, value);
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: value }),
    );
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function waitFor(
  read: () => string,
  options: { expected: string; attempts?: number } = {
    expected: "",
  },
): Promise<void> {
  const attempts = options.attempts ?? 20;
  for (let index = 0; index < attempts; index += 1) {
    if (read() === options.expected) {
      return;
    }
    await act(async () => {
      await Promise.resolve();
    });
  }
  expect(read()).toBe(options.expected);
}
