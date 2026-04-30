import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BluProvider, useRoute } from "@kitsy/blu-context";
import { createBus, type Bus } from "@kitsy/blu-bus";
import { createSlate, type Slate } from "@kitsy/blu-slate";
import type { RouteTable } from "@kitsy/blu-schema";
import {
  BluRouter,
  createMemoryHistoryDriver,
  matchRoutePath,
} from "./route.js";

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

describe("@kitsy/blu-route", () => {
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

  it("matches route params from a path pattern", () => {
    expect(matchRoutePath("/users/:id", "/users/42")).toEqual({ id: "42" });
    expect(matchRoutePath("/users/:id", "/teams/42")).toBe(null);
  });

  it("emits route projection updates from navigation events and browser back-forward", async () => {
    const runtime = createRuntimeHarness();
    const history = createMemoryHistoryDriver("/reports");
    const routes: RouteTable = {
      mode: "memory",
      routes: [
        {
          id: "reports",
          path: "/reports",
          view: { ref: "urn:app:view:reports" },
          meta: { title: "Reports" },
        },
        {
          id: "settings",
          path: "/settings/:tab",
          view: { ref: "urn:app:view:settings" },
          meta: { title: "Settings" },
        },
      ],
    };

    function Probe(): React.JSX.Element {
      const route = useRoute();
      return (
        <div>
          <span data-testid="path">{route.path}</span>
          <span data-testid="route-id">{route.routeId ?? ""}</span>
          <span data-testid="title">{String(route.meta.title ?? "")}</span>
          <span data-testid="tab">{route.params.tab ?? ""}</span>
        </div>
      );
    }

    const rendered = await renderApp(
      <BluProvider bus={runtime.bus} slate={runtime.slate}>
        <BluRouter routes={routes} history={history}>
          <Probe />
        </BluRouter>
      </BluProvider>,
    );

    expect(readByTestId(rendered.container, "path")).toBe("/reports");
    expect(readByTestId(rendered.container, "title")).toBe("Reports");

    await act(async () => {
      await runtime.bus.emit({
        type: "router:navigated",
        schemaVersion: 1,
        class: "fact",
        durability: "observable",
        payload: {
          path: "/settings/profile",
          mode: "memory",
          routeId: "settings",
          params: { tab: "profile" },
          meta: { title: "Settings" },
          matched: true,
        },
        emitter: "urn:test:route",
      });
    });

    expect(readByTestId(rendered.container, "path")).toBe("/settings/profile");
    expect(readByTestId(rendered.container, "route-id")).toBe("settings");
    expect(readByTestId(rendered.container, "tab")).toBe("profile");

    await act(async () => {
      history.back();
    });

    expect(readByTestId(rendered.container, "path")).toBe("/reports");
    expect(readByTestId(rendered.container, "title")).toBe("Reports");
  });
});

function createRuntimeHarness(): RuntimeHarness {
  const bus = createBus();
  const slate = createSlate();

  bus.subscribe(() => true, async (event) => {
    await slate.append(event);
  });

  return { bus, slate };
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

function readByTestId(container: HTMLDivElement, testId: string): string {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (element === null) {
    throw new Error(`No element found for data-testid="${testId}".`);
  }
  return element.textContent ?? "";
}
