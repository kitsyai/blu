import type { ViewReference } from "./view-node.js";
import type { Condition } from "./condition.js";

/**
 * Route table for a Blu application.
 *
 * Routes are declarative and matched in order. The first matching entry
 * wins. The runtime maintains a `route:current` projection that views
 * read from to react to navigation.
 */
export interface RouteTable {
  /** Path matching strategy. Defaults to `"history"`. */
  mode?: "history" | "hash" | "memory";
  /** Routes evaluated in order. */
  routes: RouteEntry[];
  /** Fallback view when no route matches. */
  notFound?: ViewReference;
}

export interface RouteEntry {
  /** Path pattern, e.g. `/products/:id`. */
  path: string;
  /** Stable identifier for analytics and devtools. */
  id?: string;
  /** View to render when the route matches. */
  view: ViewReference;
  /** Optional gate; the route is skipped when the condition is false. */
  guard?: Condition;
  /** Layout view that wraps the matched view. */
  layout?: ViewReference;
  /** Per-route metadata available to projections (page title, SEO tags). */
  meta?: Record<string, unknown>;
}
