import type { ApplicationConfiguration } from "@kitsy/blu-schema";

export const appConfig: ApplicationConfiguration = {
  id: "reference-app",
  name: "Blu Reference App",
  version: "1.0.0",
  shell: {
    primary: "Nav",
    primaryProps: {
      title: "Blu Reference App",
    },
    defaultTheme: "light",
  },
  routes: {
    mode: "history",
    routes: [
      {
        id: "dashboard",
        path: "/",
        view: { ref: "urn:app:view:dashboard" },
        meta: { title: "Dashboard" },
      },
      {
        id: "settings",
        path: "/settings",
        view: { ref: "urn:app:view:settings" },
        meta: { title: "Settings" },
      },
    ],
  },
  entry: {
    ref: "urn:app:view:dashboard",
  },
  eventRegistry: [
    {
      type: "router:navigated",
      defaultClass: "fact",
      defaultDurability: "observable",
      schemaVersion: 1,
    },
  ],
};
