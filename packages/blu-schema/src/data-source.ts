import type { Authority } from "@kitsy/blu-core";
import type { Binding, PropValue } from "./value.js";

/**
 * Data sources are how a Blu application pulls external data. Each
 * registration produces a projection of the same id, whose state carries
 * `{ status, data, error, fetchedAt }`. Views bind to `data:{id}` like
 * any other projection.
 *
 * See `docs/blu/specification.md` §14.
 */
export type DataSource =
  | RestDataSource
  | GraphQLDataSource
  | StaticDataSource
  | BusDataSource
  | ProjectionDataSource;

/** HTTP REST endpoint. */
export interface RestDataSource {
  kind: "rest";
  id: string;
  url: string | Binding;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string | Binding>;
  body?: PropValue;
  /** Event types whose occurrence invalidates the cached state. */
  refreshOn?: string[];
  /** Defaults to `"server-authoritative"`. */
  authority?: Authority;
}

/** GraphQL endpoint. */
export interface GraphQLDataSource {
  kind: "graphql";
  id: string;
  endpoint: string | Binding;
  query: string;
  variables?: Record<string, PropValue>;
  refreshOn?: string[];
  authority?: Authority;
}

/** Inline static data, useful for prototyping and constants. */
export interface StaticDataSource {
  kind: "static";
  id: string;
  data: unknown;
  authority?: Authority;
}

/** Stream backed by a filtered bus subscription. */
export interface BusDataSource {
  kind: "bus";
  id: string;
  /** Event types whose payloads stream into this projection. */
  on: string[];
  /** Initial value before any matching event arrives. */
  initial?: unknown;
  authority?: Authority;
}

/** Read-only projection of an existing projection (lens / transform). */
export interface ProjectionDataSource {
  kind: "projection";
  id: string;
  /** Source projection name. */
  from: string;
  /** Optional dotted path into the source state. */
  path?: string;
  /** URN of a named transform. */
  transform?: string;
  authority?: Authority;
}

/**
 * Wrapper used in `ApplicationConfiguration.dataSources` so additional
 * registration metadata can grow alongside the data source itself.
 */
export interface DataSourceRegistration {
  source: DataSource;
  /** When false, the source is registered but not auto-fetched. */
  autoFetch?: boolean;
}
