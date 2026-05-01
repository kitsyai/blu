import React, { useState } from "react";
import { useEmit, useRoute } from "@kitsy/blu-context";
import {
  BluDevtoolsPanel,
  type DevtoolsProjectionDescriptor,
  type DevtoolsTransportSnapshot,
} from "@kitsy/blu-devtools";
import { BluRouter } from "@kitsy/blu-route";
import { View } from "@kitsy/blu-view";
import { useBus, useSlate } from "@kitsy/blu-context";
import { appConfig, dashboardForms } from "./app.config";
import { createDashboardRegistry } from "./registry";
import { dashboardViews } from "./views";

const REGISTRY = createDashboardRegistry();

const PROJECTION_DESCRIPTORS: DevtoolsProjectionDescriptor[] = [
  { name: "orders", authority: "projection-authoritative" },
  { name: "orders-by-status", authority: "derived-only" },
  { name: "orders-totals", authority: "derived-only" },
  { name: "dashboard-filter", authority: "local-authoritative" },
  { name: "dashboard-presence", authority: "local-authoritative" },
  { name: "form:new-order", authority: "local-authoritative" },
  { name: "route:current", authority: "local-authoritative" },
];

interface DashboardRuntimeProps {
  transportSnapshot: DevtoolsTransportSnapshot;
}

export function DashboardRuntime({
  transportSnapshot,
}: DashboardRuntimeProps): React.JSX.Element {
  if (appConfig.routes === undefined) {
    throw new Error("Dashboard requires routes.");
  }

  return (
    <BluRouter routes={appConfig.routes}>
      <Stage transportSnapshot={transportSnapshot} />
    </BluRouter>
  );
}

function Stage({
  transportSnapshot,
}: {
  transportSnapshot: DevtoolsTransportSnapshot;
}): React.JSX.Element {
  const route = useRoute();
  const bus = useBus();
  const slate = useSlate();
  const emit = useEmit();
  const [showDevtools, setShowDevtools] = useState(false);

  const matched = appConfig.routes?.routes.find(
    (entry) => entry.id === route.routeId,
  );
  const fallback =
    appConfig.routes?.notFound?.ref ?? "urn:dashboard:view:not-found";
  const viewRef = matched?.view.ref ?? fallback;
  const node = dashboardViews[viewRef];

  if (node === undefined) {
    throw new Error(`Missing view "${viewRef}" in dashboardViews.`);
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <View
        node={node}
        registry={REGISTRY}
        forms={dashboardForms}
        onNavigate={async (to) => {
          await emit({
            type: "router:navigated",
            schemaVersion: 1,
            class: "fact",
            durability: "observable",
            payload: { path: to, mode: "history", params: {}, meta: {} },
            emitter: "urn:dashboard:runtime",
          });
        }}
      />

      <div style={{ marginTop: 24, textAlign: "right" }}>
        <button
          type="button"
          onClick={() => setShowDevtools((v) => !v)}
          style={{
            padding: "6px 12px",
            border: "1px solid var(--blu-border)",
            background: "white",
            cursor: "pointer",
            borderRadius: 8,
          }}
        >
          {showDevtools ? "Hide devtools" : "Show devtools"}
        </button>
      </div>

      {showDevtools ? (
        <div style={{ marginTop: 16 }}>
          <BluDevtoolsPanel
            bus={bus}
            slate={slate}
            projections={PROJECTION_DESCRIPTORS}
            transports={[transportSnapshot]}
            title="Dashboard devtools"
          />
        </div>
      ) : null}
    </div>
  );
}
