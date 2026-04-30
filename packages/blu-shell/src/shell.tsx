import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useBus, useEmit, useProjection, useSlate } from "@kitsy/blu-context";
import { Row, Stack } from "@kitsy/blu-grid";
import type { BluEvent, PartialEvent, Projection } from "@kitsy/blu-core";
import type {
  OverlayInstance,
  PresenterInstance,
  ShellConfiguration,
  ShellDensity,
  ShellOverlayDeclaration,
  ShellState,
  ShellTheme,
  ThemeConfiguration,
  ViewNode,
} from "@kitsy/blu-schema";
import { ThemeBoundary } from "@kitsy/blu-style";
import { View, type ComponentRegistry, type ViewProps } from "@kitsy/blu-view";

export interface BluShellProps {
  applicationId: string;
  shell: ShellConfiguration;
  entry: ViewNode;
  registry: ComponentRegistry;
  refs?: ViewProps["refs"];
  context?: ViewProps["context"];
  dataSources?: ViewProps["dataSources"];
  forms?: ViewProps["forms"];
  fetcher?: ViewProps["fetcher"];
  onNavigate?: ViewProps["onNavigate"];
  themeConfig?: ThemeConfiguration;
}

export interface ShellAPI {
  state: ShellState;
  actions: {
    openPresenter: (
      presenter: Omit<PresenterInstance, "id" | "zOrder">,
    ) => string;
    dismissPresenter: (id: string) => void;
    showOverlay: (overlay: Omit<OverlayInstance, "id">) => string;
    dismissOverlay: (id: string) => void;
    setTheme: (theme: ShellTheme) => void;
    setDensity: (density: ShellDensity) => void;
  };
}

const ShellAppContext = createContext<string | null>(null);

let shellSequence = 0;

export function BluShell({
  applicationId,
  shell,
  entry,
  registry,
  refs,
  context,
  dataSources,
  forms,
  fetcher,
  onNavigate,
  themeConfig,
}: BluShellProps): ReactNode {
  const bus = useBus();
  const emit = useMemo(() => bus.emit.bind(bus), [bus]);
  const slate = useSlate();
  const projectionName = getShellProjectionName(applicationId);
  const registrationRef = useRef<{
    key: string;
    unregister: () => void;
  } | null>(null);

  const registrationKey = `${applicationId}:${JSON.stringify(shell)}`;
  if (registrationRef.current?.key !== registrationKey) {
    registrationRef.current?.unregister();
    registrationRef.current = {
      key: registrationKey,
      unregister: registerShellProjection(slate, applicationId, shell),
    };
  }

  useEffect(() => {
    const unsubscriptions = [
      bus.subscribe("shell:presenter:open-requested", async (event) => {
        const payload = event.payload as ShellPresenterPayload;
        if (payload.applicationId !== applicationId) {
          return;
        }

        const state = readShellState(slate, applicationId, shell);
        await emitShellEvent(emit, {
          type: "shell:presenter:opened",
          class: "fact",
          durability: "journaled",
          payload: {
            ...payload,
            zOrder: state.presenters.length + 1,
          },
          emitter: "urn:blu:shell",
        });
      }),
      bus.subscribe("shell:presenter:dismiss-requested", async (event) => {
        const payload = event.payload as ShellPresenterDismissPayload;
        if (payload.applicationId !== applicationId) {
          return;
        }

        const state = readShellState(slate, applicationId, shell);
        const presenter = state.presenters.find(
          (item: PresenterInstance) => item.id === payload.id,
        );
        if (presenter === undefined) {
          return;
        }
        if (!canDismissPresenter(presenter, payload.reason)) {
          return;
        }

        await emitShellEvent(emit, {
          type: "shell:presenter:dismissed",
          class: "fact",
          durability: "journaled",
          payload,
          emitter: "urn:blu:shell",
        });
      }),
      bus.subscribe("shell:overlay:show-requested", async (event) => {
        const payload = event.payload as ShellOverlayPayload;
        if (payload.applicationId !== applicationId) {
          return;
        }
        await emitShellEvent(emit, {
          type: "shell:overlay:shown",
          class: "fact",
          durability: "journaled",
          payload,
          emitter: "urn:blu:shell",
        });
      }),
      bus.subscribe("shell:overlay:dismiss-requested", async (event) => {
        const payload = event.payload as ShellOverlayDismissPayload;
        if (payload.applicationId !== applicationId) {
          return;
        }
        await emitShellEvent(emit, {
          type: "shell:overlay:dismissed",
          class: "fact",
          durability: "journaled",
          payload,
          emitter: "urn:blu:shell",
        });
      }),
      bus.subscribe("shell:theme:change-requested", async (event) => {
        const payload = event.payload as ShellThemePayload;
        if (payload.applicationId !== applicationId) {
          return;
        }
        await emitShellEvent(emit, {
          type: "shell:theme:changed",
          class: "fact",
          durability: "journaled",
          payload,
          emitter: "urn:blu:shell",
        });
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscriptions) {
        unsubscribe();
      }
    };
  }, [applicationId, bus, emit, shell, slate]);

  useEffect(() => {
    return () => {
      registrationRef.current?.unregister();
      registrationRef.current = null;
    };
  }, []);

  const state = useProjection<ShellState>(projectionName);

  return (
    <ShellAppContext.Provider value={applicationId}>
      <ThemeBoundary
        theme={state.theme}
        density={state.density}
        config={themeConfig}
        className="blu-shell-root"
      >
        {renderOverlays(state)}
        {renderPresenters(state, {
          registry,
          refs,
          context,
          dataSources,
          forms,
          fetcher,
          onNavigate,
        })}
        {renderPrimary(
          state,
          shell,
          <View
            node={entry}
            registry={registry}
            refs={refs}
            context={context}
            dataSources={dataSources}
            forms={forms}
            fetcher={fetcher}
            onNavigate={onNavigate}
          />,
        )}
      </ThemeBoundary>
    </ShellAppContext.Provider>
  );
}

export function useShell(): ShellAPI {
  const applicationId = useContext(ShellAppContext);
  const emit = useEmit();
  if (applicationId === null) {
    throw new Error("useShell() must be used within a <BluShell>.");
  }

  const state = useProjection<ShellState>(
    getShellProjectionName(applicationId),
  );

  return useMemo(
    () => ({
      state,
      actions: {
        openPresenter: (presenter) => {
          const id = createShellId("presenter");
          void emitShellEvent(emit, {
            type: "shell:presenter:open-requested",
            class: "intent",
            durability: "observable",
            payload: {
              applicationId,
              id,
              ...presenter,
            },
            emitter: "urn:blu:shell:api",
          });
          return id;
        },
        dismissPresenter: (id) => {
          void emitShellEvent(emit, {
            type: "shell:presenter:dismiss-requested",
            class: "intent",
            durability: "observable",
            payload: {
              applicationId,
              id,
              reason: "api",
            },
            emitter: "urn:blu:shell:api",
          });
        },
        showOverlay: (overlay) => {
          const id = createShellId("overlay");
          void emitShellEvent(emit, {
            type: "shell:overlay:show-requested",
            class: "intent",
            durability: "observable",
            payload: {
              applicationId,
              id,
              ...overlay,
            },
            emitter: "urn:blu:shell:api",
          });
          return id;
        },
        dismissOverlay: (id) => {
          void emitShellEvent(emit, {
            type: "shell:overlay:dismiss-requested",
            class: "intent",
            durability: "observable",
            payload: {
              applicationId,
              id,
            },
            emitter: "urn:blu:shell:api",
          });
        },
        setTheme: (theme) => {
          void emitShellEvent(emit, {
            type: "shell:theme:change-requested",
            class: "intent",
            durability: "observable",
            payload: {
              applicationId,
              theme,
            },
            emitter: "urn:blu:shell:api",
          });
        },
        setDensity: (density) => {
          void emitShellEvent(emit, {
            type: "shell:density:changed",
            class: "fact",
            durability: "journaled",
            payload: {
              applicationId,
              density,
            },
            emitter: "urn:blu:shell:api",
          });
        },
      },
    }),
    [applicationId, emit, state],
  );
}

function renderPrimary(
  state: ShellState,
  shell: ShellConfiguration,
  entry: ReactNode,
): ReactNode {
  const title = readPrimaryTitle(shell);
  const testId = `shell-primary-${state.primary}`;

  switch (state.primary) {
    case "Blank":
      return <main data-testid={testId}>{entry}</main>;
    case "AppBar":
      return (
        <Stack gap={0}>
          <header data-testid={testId} style={headerStyle}>
            <strong>{title}</strong>
          </header>
          <main>{entry}</main>
        </Stack>
      );
    case "Nav":
      return (
        <Row gap={0}>
          <aside data-testid={testId} style={asideStyle}>
            <strong>{title}</strong>
          </aside>
          <main style={{ flex: 1 }}>{entry}</main>
        </Row>
      );
    case "Game":
    case "Canvas":
    case "Doc":
    case "Wizard":
      return (
        <main data-testid={testId} style={surfaceStyle}>
          <div style={{ marginBottom: 12, fontWeight: 700 }}>{title}</div>
          {entry}
        </main>
      );
    default:
      return <main data-testid={testId}>{entry}</main>;
  }
}

function renderPresenters(
  state: ShellState,
  viewProps: Pick<
    ViewProps,
    | "registry"
    | "refs"
    | "context"
    | "dataSources"
    | "forms"
    | "fetcher"
    | "onNavigate"
  >,
): ReactNode {
  return state.presenters.map((presenter: PresenterInstance) => (
    <div
      key={presenter.id}
      data-testid={`presenter-${presenter.kind}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100 + presenter.zOrder,
        display: "grid",
        placeItems: presenter.kind === "modal" ? "center" : "stretch",
        background: "rgba(15, 23, 42, 0.32)",
      }}
    >
      <button
        type="button"
        data-testid={`presenter-${presenter.id}-backdrop`}
        aria-label="Dismiss presenter"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "relative",
          width:
            presenter.kind === "modal"
              ? "min(520px, calc(100vw - 32px))"
              : presenter.kind === "sheet"
                ? "min(680px, 100vw)"
                : "min(380px, 100vw)",
          marginLeft:
            presenter.kind === "drawer" && presenter.attachment === "right"
              ? "auto"
              : undefined,
          marginTop: presenter.kind === "sheet" ? "auto" : undefined,
          background: "#ffffff",
          borderRadius: 18,
          border: "1px solid #d1d5db",
          padding: 20,
        }}
      >
        <View node={presenter.content} {...viewProps} />
      </div>
    </div>
  ));
}

function renderOverlays(state: ShellState): ReactNode {
  return state.overlays.map((overlay: OverlayInstance, index: number) => (
    <div
      key={overlay.id}
      data-testid={`overlay-${overlay.kind}`}
      style={{
        position: "fixed",
        top: 12 + index * 48,
        left: 12,
        right: overlay.kind === "banner" ? 12 : undefined,
        zIndex: 300 + index,
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid #d1d5db",
        background:
          overlay.severity === "error"
            ? "#fee2e2"
            : overlay.severity === "warning"
              ? "#fef3c7"
              : "#eff6ff",
      }}
    >
      {overlay.message ?? overlay.kind}
    </div>
  ));
}

function registerShellProjection(
  slate: ReturnType<typeof useSlate>,
  applicationId: string,
  shell: ShellConfiguration,
): () => void {
  const projection = createShellProjection(applicationId, shell);
  try {
    const handle = slate.registerProjection(projection);
    return () => {
      handle.unregister();
    };
  } catch {
    return () => {};
  }
}

function createShellProjection(
  applicationId: string,
  shell: ShellConfiguration,
): Projection<ShellState> {
  const projectionName = getShellProjectionName(applicationId);
  return {
    name: projectionName,
    authority: "local-authoritative",
    initialState: createInitialShellState(shell),
    eventFilter: (event) => {
      const payload = event.payload as { applicationId?: string };
      return payload.applicationId === applicationId;
    },
    reduce: (state, event) => reduceShellState(state, event),
  };
}

function createInitialShellState(shell: ShellConfiguration): ShellState {
  return {
    primary: shell.primary,
    presenters: [],
    overlays: (shell.overlays ?? []).map(
      (overlay: ShellOverlayDeclaration) => ({
        id: createShellId("overlay"),
        ...overlay,
      }),
    ),
    theme: shell.defaultTheme ?? "system",
    density: shell.defaultDensity ?? "comfortable",
  };
}

function reduceShellState(state: ShellState, event: BluEvent): ShellState {
  switch (event.type) {
    case "shell:primary:switched": {
      const payload = event.payload as { primary: ShellState["primary"] };
      return {
        ...state,
        primary: payload.primary,
      };
    }
    case "shell:presenter:opened": {
      const payload = event.payload as ShellPresenterPayload & {
        zOrder: number;
      };
      return {
        ...state,
        presenters: [
          ...state.presenters,
          {
            id: payload.id,
            kind: payload.kind,
            attachment: payload.attachment,
            content: payload.content,
            dismissOn: payload.dismissOn,
            zOrder: payload.zOrder,
          },
        ],
      };
    }
    case "shell:presenter:dismissed": {
      const payload = event.payload as ShellPresenterDismissPayload;
      return {
        ...state,
        presenters: state.presenters.filter((item) => item.id !== payload.id),
      };
    }
    case "shell:overlay:shown": {
      const payload = event.payload as ShellOverlayPayload;
      return {
        ...state,
        overlays: [
          ...state.overlays.filter(
            (item: OverlayInstance) => item.id !== payload.id,
          ),
          {
            id: payload.id,
            kind: payload.kind,
            severity: payload.severity,
            message: payload.message,
            dismissible: payload.dismissible,
            blocksInteraction: payload.blocksInteraction,
          },
        ],
      };
    }
    case "shell:overlay:dismissed": {
      const payload = event.payload as ShellOverlayDismissPayload;
      return {
        ...state,
        overlays: state.overlays.filter(
          (item: OverlayInstance) => item.id !== payload.id,
        ),
      };
    }
    case "shell:theme:changed": {
      const payload = event.payload as ShellThemePayload;
      return {
        ...state,
        theme: payload.theme,
      };
    }
    case "shell:density:changed": {
      const payload = event.payload as ShellDensityPayload;
      return {
        ...state,
        density: payload.density,
      };
    }
    default:
      return state;
  }
}

function readShellState(
  slate: ReturnType<typeof useSlate>,
  applicationId: string,
  shell: ShellConfiguration,
): ShellState {
  try {
    return slate.getProjection<ShellState>(
      getShellProjectionName(applicationId),
    );
  } catch {
    return createInitialShellState(shell);
  }
}

function canDismissPresenter(
  presenter: PresenterInstance,
  reason: ShellPresenterDismissPayload["reason"],
): boolean {
  const dismissOn = presenter.dismissOn ?? "both";
  if (dismissOn === "none") {
    return reason === "api";
  }
  if (dismissOn === "both") {
    return true;
  }
  return dismissOn === reason;
}

function readPrimaryTitle(shell: ShellConfiguration): string {
  const title = shell.primaryProps?.title;
  if (typeof title === "string" || typeof title === "number") {
    return String(title);
  }
  return shell.primary;
}

function getShellProjectionName(applicationId: string): string {
  return `shell:${applicationId}`;
}

function createShellId(prefix: "presenter" | "overlay"): string {
  shellSequence += 1;
  return `${prefix}-${shellSequence}`;
}

async function emitShellEvent<TPayload>(
  emit: ReturnType<typeof useEmit>,
  partial: Omit<
    PartialEvent<TPayload>,
    "schemaVersion" | "scopePath" | "origin"
  >,
): Promise<BluEvent<TPayload>> {
  return emit({
    ...partial,
    schemaVersion: 1,
    scopePath: "app/shell",
    origin: "system",
  });
}

const headerStyle = {
  display: "flex",
  alignItems: "center",
  minHeight: 56,
  padding: "0 16px",
  borderBottom: "1px solid #d1d5db",
  background: "#ffffff",
} as const;

const asideStyle = {
  width: 220,
  padding: 16,
  borderRight: "1px solid #d1d5db",
  background: "#f8fafc",
} as const;

const surfaceStyle = {
  minHeight: "100vh",
  padding: 20,
  background: "#ffffff",
} as const;

interface ShellPresenterPayload {
  applicationId: string;
  id: string;
  kind: PresenterInstance["kind"];
  attachment?: PresenterInstance["attachment"];
  content: ViewNode;
  dismissOn?: PresenterInstance["dismissOn"];
}

interface ShellPresenterDismissPayload {
  applicationId: string;
  id: string;
  reason: "backdrop" | "escape" | "api";
}

interface ShellOverlayPayload {
  applicationId: string;
  id: string;
  kind: OverlayInstance["kind"];
  severity?: OverlayInstance["severity"];
  message?: string;
  dismissible?: boolean;
  blocksInteraction?: boolean;
}

interface ShellOverlayDismissPayload {
  applicationId: string;
  id: string;
}

interface ShellThemePayload {
  applicationId: string;
  theme: ShellTheme;
}

interface ShellDensityPayload {
  applicationId: string;
  density: ShellDensity;
}
