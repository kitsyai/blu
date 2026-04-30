export interface RouteState {
  /** History mode currently backing the router. */
  mode: "history" | "hash" | "memory";
  /** Current browser-visible path. */
  path: string;
  /** Matched route id when available. */
  routeId?: string;
  /** Params extracted from the route pattern. */
  params: Record<string, string>;
  /** Per-route metadata carried into runtime consumers like shell. */
  meta: Record<string, unknown>;
  /** Whether a route entry matched the current path. */
  matched: boolean;
}
