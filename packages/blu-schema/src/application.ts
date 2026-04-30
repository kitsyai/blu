import type { ViewReference } from "./view-node.js";
import type { RouteTable } from "./route.js";
import type { ThemeConfiguration } from "./theme.js";
import type { DataSourceRegistration } from "./data-source.js";
import type { ShellConfiguration } from "./shell.js";
import type {
  ProjectionRegistration,
  EventRegistration,
} from "./registration.js";

/**
 * Root contract for a Blu application.
 *
 * The runtime consumes an `ApplicationConfiguration` as data: it registers
 * projections and data sources, applies the theme, mounts the entry view,
 * and starts the router.
 *
 * See `docs/blu/specification.md` §10.
 */
export interface ApplicationConfiguration {
  /** Application id. URN-compatible identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Application version (semver string). */
  version: string;
  /** Entry view; rendered when no route matches a more specific entry. */
  entry: ViewReference;
  /** Optional route table. */
  routes?: RouteTable;
  /** Optional theme tokens. */
  theme?: ThemeConfiguration;
  /** Optional shell configuration. */
  shell?: ShellConfiguration;
  /** Data source registrations. */
  dataSources?: DataSourceRegistration[];
  /** Projection registrations. */
  projections?: ProjectionRegistration[];
  /** Event type registrations. */
  eventRegistry?: EventRegistration[];
  /** Free-form metadata available to projections (analytics ids, brand). */
  meta?: Record<string, unknown>;
}
