import type { ApplicationConfiguration } from "@kitsy/blu-schema";
import { newOrderForm } from "./forms";

/**
 * The single source of truth for the dashboard application.
 *
 * Everything the user can see — routes, the entry view, the shell, the
 * registered events, the registered data sources, the form definition — is
 * declared here as data, not code. The runtime (`runtime.tsx`) is a thin
 * shim that mounts BluProvider, BluRouter, and the schema renderer.
 */
export const appConfig: ApplicationConfiguration = {
  id: "blu-dashboard",
  name: "Blu Sales Dashboard",
  version: "1.0.0",
  shell: {
    primary: "AppBar",
    primaryProps: {
      title: "Blu Sales Dashboard",
    },
    defaultTheme: "light",
  },
  entry: { ref: "urn:dashboard:view:orders-list" },
  routes: {
    mode: "history",
    routes: [
      {
        id: "orders-list",
        path: "/",
        view: { ref: "urn:dashboard:view:orders-list" },
        meta: { title: "Orders" },
      },
      {
        id: "new-order",
        path: "/orders/new",
        view: { ref: "urn:dashboard:view:new-order" },
        meta: { title: "New order" },
      },
    ],
    notFound: { ref: "urn:dashboard:view:not-found" },
  },
  // The form runtime registers a `form:new-order` projection automatically
  // when blu-view sees this in `ViewProps.forms`.
  // We surface it here too so other tools (validators, devtools) can find
  // the canonical FormDefinition. Note: ApplicationConfiguration does not
  // currently have a `forms` slot — the form definition is wired into the
  // View runtime by `runtime.tsx` instead.
  eventRegistry: [
    {
      type: "router:navigated",
      defaultClass: "fact",
      defaultDurability: "observable",
      schemaVersion: 1,
    },
    {
      type: "orders:created",
      defaultClass: "fact",
      defaultDurability: "replicated",
      schemaVersion: 1,
    },
    {
      type: "orders:status-updated",
      defaultClass: "fact",
      defaultDurability: "replicated",
      schemaVersion: 1,
    },
    {
      type: "dashboard:filter-changed",
      defaultClass: "fact",
      defaultDurability: "observable",
      schemaVersion: 1,
    },
    {
      type: "dashboard:tab-joined",
      defaultClass: "system",
      defaultDurability: "observable",
      schemaVersion: 1,
    },
    {
      type: "dashboard:tab-left",
      defaultClass: "system",
      defaultDurability: "observable",
      schemaVersion: 1,
    },
  ],
};

export const dashboardForms = [newOrderForm];
