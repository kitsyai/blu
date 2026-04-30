import React from "react";
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
      <BluShell
        applicationId={appConfig.id}
        shell={appConfig.shell ?? { primary: "Blank" }}
        entry={views["urn:app:view:dashboard"]}
        registry={registry}
      />
    </BluRouter>
  );
}
