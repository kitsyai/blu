import { bluGridEntries } from "@kitsy/blu-grid";
import { bluUiEntries } from "@kitsy/blu-ui";
import type { ViewNode } from "@kitsy/blu-schema";
import { createComponentRegistry } from "@kitsy/blu-view";

export const views: Record<string, ViewNode> = {
  "urn:app:view:dashboard": {
    component: "urn:blu:grid:stack",
    props: { gap: 16 },
    children: [
      {
        component: "urn:blu:ui:card",
        children: [
          {
            component: "urn:blu:ui:text",
            props: { value: "Dashboard" },
          },
        ],
      },
    ],
  },
  "urn:app:view:settings": {
    component: "urn:blu:grid:stack",
    props: { gap: 12 },
    children: [
      {
        component: "urn:blu:ui:text",
        props: { value: "Settings" },
      },
      {
        component: "urn:blu:ui:input",
        props: { value: "Profile" },
      },
    ],
  },
};

export function createRegistry() {
  const registry = createComponentRegistry();
  for (const entry of [...bluGridEntries, ...bluUiEntries]) {
    registry.register(entry.urn, entry.component, entry.meta);
  }
  return registry;
}
