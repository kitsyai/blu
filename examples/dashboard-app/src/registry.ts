import { bluGridEntries } from "@kitsy/blu-grid";
import { bluUiEntries } from "@kitsy/blu-ui";
import { ComponentRegistry, createComponentRegistry } from "@kitsy/blu-view";

/**
 * Build the component registry the dashboard renders against.
 *
 * Every URN referenced in `views.ts` must be registered here.
 */
export function createDashboardRegistry(): ComponentRegistry {
  const registry = createComponentRegistry();
  for (const entry of [...bluGridEntries, ...bluUiEntries]) {
    registry.register(entry.urn, entry.component, entry.meta);
  }
  return registry;
}
