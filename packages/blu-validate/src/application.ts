import type { ApplicationConfiguration } from "@kitsy/blu-schema";
import { isAuthority, isDurability, isEventClass } from "@kitsy/blu-core";
import { ErrorCollector, err, ok, type Result } from "./result.js";
import { validateViewNodeInto } from "./view-node.js";
import { validateDataSourceInto } from "./data-source.js";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
const PRIMARY_KINDS = new Set([
  "Blank",
  "AppBar",
  "Nav",
  "Game",
  "Canvas",
  "Doc",
  "Wizard",
]);
const THEME_KINDS = new Set(["light", "dark", "system"]);
const DENSITY_KINDS = new Set(["comfortable", "compact"]);
const OVERLAY_KINDS = new Set(["beta", "maintenance", "offline", "banner"]);
const SEVERITY_KINDS = new Set(["info", "warning", "error"]);

export function validateApplicationConfiguration(
  config: unknown,
): Result<ApplicationConfiguration> {
  const c = new ErrorCollector("");
  if (!isObject(config)) {
    c.push("app.shape.notObject", "ApplicationConfiguration must be an object");
    return err(c.errors());
  }

  if (typeof config.id !== "string" || config.id.length === 0) {
    c.push("app.missing.id", "ApplicationConfiguration.id is required", "id");
  }
  if (typeof config.name !== "string" || config.name.length === 0) {
    c.push(
      "app.missing.name",
      "ApplicationConfiguration.name is required",
      "name",
    );
  }
  if (
    typeof config.version !== "string" ||
    !SEMVER_PATTERN.test(config.version)
  ) {
    c.push(
      "app.invalid.version",
      "ApplicationConfiguration.version must be a semver string",
      "version",
    );
  }

  if (!isObject(config.entry)) {
    c.push(
      "app.missing.entry",
      "ApplicationConfiguration.entry is required",
      "entry",
    );
  } else {
    validateViewReferenceInto(config.entry, c.child("entry"));
  }

  if (config.routes !== undefined) {
    if (!isObject(config.routes)) {
      c.push(
        "app.invalid.routes",
        "routes must be an object when present",
        "routes",
      );
    } else {
      const routes = (config.routes as Record<string, unknown>).routes;
      if (!Array.isArray(routes)) {
        c.push(
          "app.routes.missing.routes",
          "routes.routes must be an array",
          "routes.routes",
        );
      } else {
        routes.forEach((route, i) => {
          const rc = c.child("routes").child("routes").child(i);
          if (!isObject(route)) {
            rc.push(
              "app.routes.entry.shape.notObject",
              "RouteEntry must be an object",
            );
            return;
          }
          if (typeof route.path !== "string" || route.path.length === 0) {
            rc.push(
              "app.routes.entry.missing.path",
              "RouteEntry.path is required",
              "path",
            );
          }
          if (!isObject(route.view)) {
            rc.push(
              "app.routes.entry.missing.view",
              "RouteEntry.view is required",
              "view",
            );
          } else {
            validateViewReferenceInto(route.view, rc.child("view"));
          }
        });
      }
    }
  }

  if (config.shell !== undefined) {
    if (!isObject(config.shell)) {
      c.push(
        "app.invalid.shell",
        "shell must be an object when present",
        "shell",
      );
    } else {
      validateShellInto(config.shell, c.child("shell"));
    }
  }

  if (config.dataSources !== undefined) {
    if (!Array.isArray(config.dataSources)) {
      c.push(
        "app.invalid.dataSources",
        "dataSources must be an array when present",
        "dataSources",
      );
    } else {
      config.dataSources.forEach((reg, i) => {
        const rc = c.child("dataSources").child(i);
        if (!isObject(reg) || !isObject(reg.source)) {
          rc.push(
            "app.dataSources.invalid.entry",
            "DataSourceRegistration must contain a source object",
          );
          return;
        }
        validateDataSourceInto(reg.source, rc.child("source"));
      });
    }
  }

  if (config.projections !== undefined) {
    if (!Array.isArray(config.projections)) {
      c.push(
        "app.invalid.projections",
        "projections must be an array when present",
        "projections",
      );
    } else {
      config.projections.forEach((reg, i) => {
        const rc = c.child("projections").child(i);
        if (!isObject(reg)) {
          rc.push(
            "app.projections.shape.notObject",
            "ProjectionRegistration must be an object",
          );
          return;
        }
        if (typeof reg.name !== "string" || reg.name.length === 0) {
          rc.push(
            "app.projections.missing.name",
            "ProjectionRegistration.name is required",
            "name",
          );
        }
        if (typeof reg.kind !== "string" || reg.kind.length === 0) {
          rc.push(
            "app.projections.missing.kind",
            "ProjectionRegistration.kind is required",
            "kind",
          );
        }
        if (!isAuthority(reg.authority)) {
          rc.push(
            "app.projections.invalid.authority",
            "ProjectionRegistration.authority must be a valid Authority",
            "authority",
          );
        }
      });
    }
  }

  if (config.eventRegistry !== undefined) {
    if (!Array.isArray(config.eventRegistry)) {
      c.push(
        "app.invalid.eventRegistry",
        "eventRegistry must be an array when present",
        "eventRegistry",
      );
    } else {
      config.eventRegistry.forEach((reg, i) => {
        const rc = c.child("eventRegistry").child(i);
        if (!isObject(reg)) {
          rc.push(
            "app.eventRegistry.shape.notObject",
            "EventRegistration must be an object",
          );
          return;
        }
        if (typeof reg.type !== "string" || reg.type.length === 0) {
          rc.push(
            "app.eventRegistry.missing.type",
            "EventRegistration.type is required",
            "type",
          );
        }
        if (!isEventClass(reg.defaultClass)) {
          rc.push(
            "app.eventRegistry.invalid.defaultClass",
            "EventRegistration.defaultClass must be a valid EventClass",
            "defaultClass",
          );
        }
        if (!isDurability(reg.defaultDurability)) {
          rc.push(
            "app.eventRegistry.invalid.defaultDurability",
            "EventRegistration.defaultDurability must be a valid Durability",
            "defaultDurability",
          );
        }
        if (
          typeof reg.schemaVersion !== "number" ||
          !Number.isInteger(reg.schemaVersion)
        ) {
          rc.push(
            "app.eventRegistry.invalid.schemaVersion",
            "EventRegistration.schemaVersion must be an integer",
            "schemaVersion",
          );
        }
      });
    }
  }

  if (c.hasErrors()) return err(c.errors());
  return ok(config as unknown as ApplicationConfiguration);
}

function validateViewReferenceInto(value: unknown, c: ErrorCollector): void {
  if (!isObject(value)) {
    c.push("view-ref.shape.notObject", "ViewReference must be an object");
    return;
  }
  const hasInline = isObject(value.inline);
  const hasRef = typeof value.ref === "string" && value.ref.length > 0;
  if (!hasInline && !hasRef) {
    c.push(
      "view-ref.empty",
      "ViewReference must have either an inline ViewNode or a ref URN",
    );
    return;
  }
  if (hasInline && hasRef) {
    c.push(
      "view-ref.ambiguous",
      "ViewReference must not specify both inline and ref",
    );
  }
  if (hasInline) {
    validateViewNodeInto(value.inline, c.child("inline"));
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateShellInto(
  value: Record<string, unknown>,
  c: ErrorCollector,
): void {
  if (typeof value.primary !== "string" || !PRIMARY_KINDS.has(value.primary)) {
    c.push(
      "app.shell.invalid.primary",
      "shell.primary must be one of the known primary kinds",
      "primary",
    );
  }

  if (
    value.defaultTheme !== undefined &&
    (typeof value.defaultTheme !== "string" ||
      !THEME_KINDS.has(value.defaultTheme))
  ) {
    c.push(
      "app.shell.invalid.defaultTheme",
      "shell.defaultTheme must be light, dark, or system",
      "defaultTheme",
    );
  }

  if (
    value.defaultDensity !== undefined &&
    (typeof value.defaultDensity !== "string" ||
      !DENSITY_KINDS.has(value.defaultDensity))
  ) {
    c.push(
      "app.shell.invalid.defaultDensity",
      "shell.defaultDensity must be comfortable or compact",
      "defaultDensity",
    );
  }

  if (value.primaryProps !== undefined && !isObject(value.primaryProps)) {
    c.push(
      "app.shell.invalid.primaryProps",
      "shell.primaryProps must be an object when present",
      "primaryProps",
    );
  }

  if (value.overlays !== undefined) {
    if (!Array.isArray(value.overlays)) {
      c.push(
        "app.shell.invalid.overlays",
        "shell.overlays must be an array when present",
        "overlays",
      );
    } else {
      value.overlays.forEach((overlay, index) => {
        const oc = c.child("overlays").child(index);
        if (!isObject(overlay)) {
          oc.push(
            "app.shell.overlay.invalid.shape",
            "Shell overlay declarations must be objects",
          );
          return;
        }

        if (
          typeof overlay.kind !== "string" ||
          !OVERLAY_KINDS.has(overlay.kind)
        ) {
          oc.push(
            "app.shell.overlay.invalid.kind",
            "shell overlay kind must be beta, maintenance, offline, or banner",
            "kind",
          );
        }

        if (
          overlay.severity !== undefined &&
          (typeof overlay.severity !== "string" ||
            !SEVERITY_KINDS.has(overlay.severity))
        ) {
          oc.push(
            "app.shell.overlay.invalid.severity",
            "shell overlay severity must be info, warning, or error",
            "severity",
          );
        }
      });
    }
  }
}
