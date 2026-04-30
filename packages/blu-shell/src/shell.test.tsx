import React, { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BluProvider } from "@kitsy/blu-context";
import { createBus, type Bus } from "@kitsy/blu-bus";
import type { Projection } from "@kitsy/blu-core";
import type { ViewNode } from "@kitsy/blu-schema";
import { createSlate, type Slate } from "@kitsy/blu-slate";
import { bluGridEntries } from "@kitsy/blu-grid";
import { bluUiEntries } from "@kitsy/blu-ui";
import { ComponentRegistry, createComponentRegistry } from "@kitsy/blu-view";
import { BluShell, useShell } from "./shell.js";

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

describe("@kitsy/blu-shell", () => {
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

  it("renders AppBar content and hosts a modal presenter that opens and dismisses via shell events", async () => {
    const runtime = createRuntimeHarness();
    const registry = createShellRegistry();

    const rendered = await renderShell(runtime, registry, {
      shell: {
        primary: "AppBar",
        primaryProps: {
          title: "Orders",
        },
      },
      entry: {
        component: "urn:test:shell-launcher",
      },
    });

    expect(readByTestId(rendered.container, "shell-primary-AppBar")).toContain(
      "Orders",
    );
    expect(readByTestId(rendered.container, "shell-launcher")).toContain(
      "Open modal",
    );

    await clickByText(rendered.container, "Open modal");
    expect(readByTestId(rendered.container, "presenter-modal")).toContain(
      "Presenter body",
    );

    await act(async () => {
      await runtime.bus.emit({
        type: "shell:presenter:dismiss-requested",
        schemaVersion: 1,
        class: "intent",
        durability: "observable",
        payload: {
          applicationId: "demo",
          id: "presenter-1",
          reason: "api",
        },
        emitter: "urn:test:dismiss",
      });
    });

    expect(
      rendered.container.querySelector('[data-testid="presenter-modal"]'),
    ).toBe(null);
  });

  it("updates theme attributes without remounting the entry subtree", async () => {
    const runtime = createRuntimeHarness();
    const registry = createShellRegistry();

    const rendered = await renderShell(runtime, registry, {
      shell: {
        primary: "Blank",
        defaultTheme: "light",
      },
      entry: {
        component: "urn:test:theme-probe",
      },
    });

    const root = rendered.container.querySelector("[data-blu-theme]");
    expect(root?.getAttribute("data-blu-theme")).toBe("light");
    expect(readByTestId(rendered.container, "theme-probe")).toBe("1");

    await clickByText(rendered.container, "Toggle theme");
    expect(root?.getAttribute("data-blu-theme")).toBe("dark");
    expect(readByTestId(rendered.container, "theme-probe")).toBe("1");
  });

  it("renders a representative ui application under all seven primaries", async () => {
    const runtime = createRuntimeHarness();
    const registry = createShellRegistry();
    const entry = createRepresentativeEntry();

    for (const primary of [
      "Blank",
      "AppBar",
      "Nav",
      "Game",
      "Canvas",
      "Doc",
      "Wizard",
    ] as const) {
      const rendered = await renderShell(runtime, registry, {
        shell: {
          primary,
          primaryProps: {
            title: `${primary} title`,
          },
        },
        entry,
      });

      expect(rendered.container.textContent).toContain("Representative app");
      expect(
        rendered.container.querySelector(
          `[data-testid="shell-primary-${primary}"]`,
        ),
      ).not.toBeNull();

      await rendered.unmount();
    }
  });

  it("supports overlay and presenter open/dismiss cycles across kinds", async () => {
    const runtime = createRuntimeHarness();
    const registry = createShellRegistry();

    const rendered = await renderShell(runtime, registry, {
      shell: {
        primary: "Blank",
      },
      entry: {
        component: "urn:test:shell-cycle",
      },
    });

    await clickByText(rendered.container, "Open drawer");
    await clickByText(rendered.container, "Show banner");
    expect(readByTestId(rendered.container, "presenter-drawer")).toContain(
      "Drawer body",
    );
    expect(readByTestId(rendered.container, "overlay-banner")).toContain(
      "Heads up",
    );

    await clickByText(rendered.container, "Dismiss all");
    expect(
      rendered.container.querySelector('[data-testid="presenter-drawer"]'),
    ).toBe(null);
    expect(
      rendered.container.querySelector('[data-testid="overlay-banner"]'),
    ).toBe(null);
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

function createShellRegistry(): ComponentRegistry {
  const registry = createComponentRegistry();

  for (const entry of [...bluGridEntries, ...bluUiEntries]) {
    registry.register(entry.urn, entry.component, entry.meta);
  }

  registry.register(
    "urn:test:shell-launcher",
    ShellLauncher,
    createMeta("urn:test:shell-launcher"),
  );
  registry.register(
    "urn:test:theme-probe",
    ThemeProbe,
    createMeta("urn:test:theme-probe"),
  );
  registry.register(
    "urn:test:shell-cycle",
    ShellCycle,
    createMeta("urn:test:shell-cycle"),
  );

  return registry;
}

function ShellLauncher(): React.JSX.Element {
  const shell = useShell();
  return (
    <div data-testid="shell-launcher">
      <button
        type="button"
        onClick={() => {
          shell.actions.openPresenter({
            kind: "modal",
            dismissOn: "both",
            content: {
              component: "urn:blu:ui:modal-content",
              props: {
                title: "Presenter body",
              },
              children: [
                {
                  component: "urn:blu:ui:text",
                  props: {
                    value: "Presenter body",
                  },
                },
              ],
            },
          });
        }}
      >
        Open modal
      </button>
    </div>
  );
}

function ThemeProbe(): React.JSX.Element {
  const shell = useShell();
  const [token] = useState(1);

  return (
    <div>
      <span data-testid="theme-probe">{String(token)}</span>
      <button
        type="button"
        onClick={() => {
          shell.actions.setTheme(
            shell.state.theme === "light" ? "dark" : "light",
          );
        }}
      >
        Toggle theme
      </button>
    </div>
  );
}

function ShellCycle(): React.JSX.Element {
  const shell = useShell();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [overlayId, setOverlayId] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setDrawerId(
            shell.actions.openPresenter({
              kind: "drawer",
              attachment: "right",
              dismissOn: "both",
              content: {
                component: "urn:blu:ui:modal-content",
                props: {
                  title: "Drawer body",
                },
                children: [
                  {
                    component: "urn:blu:ui:text",
                    props: {
                      value: "Drawer body",
                    },
                  },
                ],
              },
            }),
          );
        }}
      >
        Open drawer
      </button>
      <button
        type="button"
        onClick={() => {
          setOverlayId(
            shell.actions.showOverlay({
              kind: "banner",
              severity: "info",
              message: "Heads up",
            }),
          );
        }}
      >
        Show banner
      </button>
      <button
        type="button"
        onClick={() => {
          if (drawerId !== null) {
            shell.actions.dismissPresenter(drawerId);
          }
          if (overlayId !== null) {
            shell.actions.dismissOverlay(overlayId);
          }
        }}
      >
        Dismiss all
      </button>
    </div>
  );
}

function createRepresentativeEntry(): ViewNode {
  return {
    component: "urn:blu:grid:stack",
    props: {
      gap: 16,
    },
    children: [
      {
        component: "urn:blu:ui:card",
        children: [
          {
            component: "urn:blu:grid:stack",
            props: {
              gap: 8,
            },
            children: [
              {
                component: "urn:blu:ui:text",
                props: {
                  value: "Representative app",
                },
              },
              {
                component: "urn:blu:grid:row",
                props: {
                  gap: 8,
                },
                children: [
                  {
                    component: "urn:blu:ui:input",
                    props: {
                      value: "hello",
                    },
                  },
                  {
                    component: "urn:blu:ui:button",
                    props: {
                      label: "Action",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function createMeta(urn: string) {
  return {
    urn,
    displayName: urn,
    description: urn,
    category: "block" as const,
    version: "1.0.0",
    props: {
      type: "object" as const,
      properties: {},
    },
  };
}

async function renderShell(
  runtime: RuntimeHarness,
  registry: ComponentRegistry,
  options: {
    shell: Parameters<typeof BluShell>[0]["shell"];
    entry: ViewNode;
  },
): Promise<RenderHarness> {
  return renderApp(
    <BluProvider bus={runtime.bus} slate={runtime.slate}>
      <BluShell
        applicationId="demo"
        shell={options.shell}
        entry={options.entry}
        registry={registry}
      />
    </BluProvider>,
  );
}

function registerProjection<T>(slate: Slate, projection: Projection<T>): void {
  slate.registerProjection(projection);
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

async function clickByText(
  container: HTMLDivElement,
  text: string,
): Promise<void> {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button "${text}" not found.`);
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
