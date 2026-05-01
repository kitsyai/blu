import type { ApplicationConfiguration } from "@kitsy/blu-schema";

export const appConfig: ApplicationConfiguration = {
  id: "reference-app",
  name: "Blu Reference App",
  version: "1.0.0",
  shell: {
    primary: "AppBar",
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
    {
      type: "reference:tab-joined",
      defaultClass: "system",
      defaultDurability: "replicated",
      schemaVersion: 1,
    },
    {
      type: "reference:tab-left",
      defaultClass: "system",
      defaultDurability: "replicated",
      schemaVersion: 1,
    },
    {
      type: "shell:theme:change-requested",
      defaultClass: "intent",
      defaultDurability: "observable",
      schemaVersion: 1,
    },
  ],
};
