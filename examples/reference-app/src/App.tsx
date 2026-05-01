import React from "react";
import { useEmit, useProjection, useRoute } from "@kitsy/blu-context";
import { BluRouter } from "@kitsy/blu-route";
import { BluShell } from "@kitsy/blu-shell";
import type { PrimaryKind, ShellState, ShellTheme } from "@kitsy/blu-schema";
import { appConfig } from "./app.config";
import { createRegistry, views } from "./registry";

const PRIMARY_OPTIONS: PrimaryKind[] = ["AppBar", "Nav", "Doc"];
const SHELL_PROJECTION = `shell:${appConfig.id}`;

export function App(): React.JSX.Element {
  const registry = React.useMemo(() => createRegistry(), []);
  if (appConfig.routes === undefined) {
    throw new Error("Reference app requires routes.");
  }

  return (
    <BluRouter routes={appConfig.routes}>
      <RouteDrivenShell registry={registry} />
      <Stage4Controls />
    </BluRouter>
  );
}

function RouteDrivenShell({
  registry,
}: {
  registry: ReturnType<typeof createRegistry>;
}): React.JSX.Element {
  const route = useRoute();
  const routeEntry = appConfig.routes?.routes.find(
    (candidate) => candidate.id === route.routeId,
  );
  const fallbackRef =
    appConfig.routes?.notFound?.ref ??
    appConfig.entry.ref ??
    Object.keys(views)[0];

  if (fallbackRef === undefined) {
    throw new Error("Reference app has no views registered.");
  }

  const entryRef = routeEntry?.view.ref ?? fallbackRef;
  const entry = views[entryRef];
  if (entry === undefined) {
    throw new Error(`Missing view for route entry "${entryRef}".`);
  }

  const [primary, setPrimary] = React.useState<PrimaryKind>(
    appConfig.shell?.primary ?? "AppBar",
  );

  // Cycle the primary chrome from the floating control panel.
  React.useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<PrimaryKind>).detail;
      setPrimary(detail);
    };
    window.addEventListener("blu-ref-app:primary", handler);
    return () => window.removeEventListener("blu-ref-app:primary", handler);
  }, []);

  const shellConfig = React.useMemo(
    () => ({
      ...(appConfig.shell ?? {}),
      primary,
      primaryProps: {
        ...(appConfig.shell?.primaryProps ?? {}),
        title: "Blu Reference App",
      },
    }),
    [primary],
  );

  return (
    <BluShell
      applicationId={appConfig.id}
      shell={shellConfig}
      entry={entry}
      registry={registry}
    />
  );
}

/**
 * Stage 4 demo controls: theme toggle + primary switcher + cross-tab presence.
 *
 * Intentionally a thin React surface that talks to the bus and reads the
 * shell projection directly. It doesn't use `useShell()` because that hook
 * lives inside `<BluShell>` and would only be available to components
 * rendered as the shell entry.
 */
function Stage4Controls(): React.JSX.Element {
  const emit = useEmit();
  const presence = useProjection<{ tabs: number }>("reference-presence");
  const shellState = useProjection<ShellState>(SHELL_PROJECTION);

  const [primary, setPrimary] = React.useState<PrimaryKind>("AppBar");

  const onPrimaryChange = (next: PrimaryKind): void => {
    setPrimary(next);
    window.dispatchEvent(
      new CustomEvent<PrimaryKind>("blu-ref-app:primary", { detail: next }),
    );
  };

  const toggleTheme = async (): Promise<void> => {
    const next: ShellTheme = shellState.theme === "dark" ? "light" : "dark";
    await emit({
      type: "shell:theme:change-requested",
      schemaVersion: 1,
      class: "intent",
      durability: "observable",
      payload: { applicationId: appConfig.id, theme: next },
      emitter: "urn:reference-app:controls",
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "10px 14px",
        background: "var(--blu-surface, #ffffff)",
        color: "var(--blu-text, #111827)",
        border: "1px solid var(--blu-border, #d1d5db)",
        borderRadius: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
        font: "inherit",
        fontSize: 13,
        zIndex: 100,
      }}
    >
      <span style={{ color: "var(--blu-text-muted, #6b7280)" }}>tabs</span>
      <strong>{presence.tabs}</strong>
      <span style={{ color: "var(--blu-text-muted, #6b7280)" }}>·</span>
      <label>
        primary&nbsp;
        <select
          value={primary}
          onChange={(event) =>
            onPrimaryChange(event.target.value as PrimaryKind)
          }
        >
          {PRIMARY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => void toggleTheme()}>
        {shellState.theme === "dark" ? "☀ light" : "☾ dark"}
      </button>
    </div>
  );
}
