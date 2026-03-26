import * as React from "react";
import { ApplicationProvider } from "@kitsy/blu-context";
import { NavigationProvider, Router } from "@kitsy/blu-route";
import { ReactApplicationAttributes } from "./@types/Application";
import { PageNotFound } from "./views/PageNotFound";

export function ReactApplication({
  init,
  routes,
}: ReactApplicationAttributes): React.JSX.Element {
  console.log("init app = ", init);
  console.log("routes = ", routes);

  return (
    <React.StrictMode>
      <ApplicationProvider value={init}>
        <NavigationProvider>
          <Router routes={routes} x404={PageNotFound} />
        </NavigationProvider>
      </ApplicationProvider>
    </React.StrictMode>
  );
}
