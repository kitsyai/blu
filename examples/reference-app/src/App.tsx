import React from "react";
import { useRoute } from "@kitsy/blu-context";
import { BluRouter } from "@kitsy/blu-route";
import { BluShell } from "@kitsy/blu-shell";
import { appConfig } from "./app.config";
import { createRegistry, views } from "./registry";

export function App(): React.JSX.Element {
  const registry = createRegistry();
  if (appConfig.routes === undefined) {
    throw new Error("Reference app requires routes.");
  }

  return (
    <BluRouter routes={appConfig.routes}>
      <RouteDrivenShell registry={registry} />
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
  const entryRef =
    routeEntry?.view.ref ??
    appConfig.routes?.notFound?.ref ??
    appConfig.entry.ref;
  const entry = views[entryRef];
  if (entry === undefined) {
    throw new Error(`Missing view for route entry "${entryRef}".`);
  }

  return (
    <BluShell
      applicationId={appConfig.id}
      shell={appConfig.shell ?? { primary: "Blank" }}
      entry={entry}
      registry={registry}
    />
  );
}
