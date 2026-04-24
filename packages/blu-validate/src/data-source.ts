import type { DataSource } from "@kitsy/blu-schema";
import { isAuthority } from "@kitsy/blu-core";
import { ErrorCollector, err, ok, type Result } from "./result.js";

const KNOWN_KINDS = new Set(["rest", "graphql", "static", "bus", "projection"]);
const REST_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);

export function validateDataSource(source: unknown): Result<DataSource> {
  const c = new ErrorCollector("");
  validateDataSourceInto(source, c);
  if (c.hasErrors()) return err(c.errors());
  return ok(source as DataSource);
}

export function validateDataSourceInto(
  source: unknown,
  c: ErrorCollector,
): void {
  if (!isObject(source)) {
    c.push("data-source.shape.notObject", "DataSource must be an object");
    return;
  }
  if (typeof source.id !== "string" || source.id.length === 0) {
    c.push("data-source.missing.id", "DataSource.id is required", "id");
  }
  if (source.authority !== undefined && !isAuthority(source.authority)) {
    c.push(
      "data-source.invalid.authority",
      "DataSource.authority must be a valid Authority when present",
      "authority",
    );
  }
  const kind = source.kind;
  if (typeof kind !== "string" || !KNOWN_KINDS.has(kind)) {
    c.push(
      "data-source.invalid.kind",
      `DataSource.kind must be one of: rest, graphql, static, bus, projection (got ${String(kind)})`,
      "kind",
    );
    return;
  }

  switch (kind) {
    case "rest":
      if (!isStringOrBinding(source.url)) {
        c.push(
          "data-source.rest.invalid.url",
          "rest.url must be a string or Binding",
          "url",
        );
      }
      if (
        source.method !== undefined &&
        (typeof source.method !== "string" || !REST_METHODS.has(source.method))
      ) {
        c.push(
          "data-source.rest.invalid.method",
          "rest.method must be one of: GET, POST, PUT, DELETE, PATCH",
          "method",
        );
      }
      break;
    case "graphql":
      if (!isStringOrBinding(source.endpoint)) {
        c.push(
          "data-source.graphql.invalid.endpoint",
          "graphql.endpoint must be a string or Binding",
          "endpoint",
        );
      }
      if (typeof source.query !== "string" || source.query.length === 0) {
        c.push(
          "data-source.graphql.missing.query",
          "graphql.query is required",
          "query",
        );
      }
      break;
    case "static":
      if (!("data" in source)) {
        c.push(
          "data-source.static.missing.data",
          "static.data is required",
          "data",
        );
      }
      break;
    case "bus":
      if (!Array.isArray(source.on) || source.on.length === 0) {
        c.push(
          "data-source.bus.missing.on",
          "bus.on must be a non-empty array of event types",
          "on",
        );
      } else {
        source.on.forEach((t, i) => {
          if (typeof t !== "string" || t.length === 0) {
            c.child("on").push(
              "data-source.bus.invalid.on",
              "bus.on entries must be non-empty strings",
              i,
            );
          }
        });
      }
      break;
    case "projection":
      if (typeof source.from !== "string" || source.from.length === 0) {
        c.push(
          "data-source.projection.missing.from",
          "projection.from is required",
          "from",
        );
      }
      break;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBinding(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof (value as Record<string, unknown>).source === "string" &&
    typeof (value as Record<string, unknown>).path === "string"
  );
}

function isStringOrBinding(value: unknown): boolean {
  return typeof value === "string" || isBinding(value);
}
