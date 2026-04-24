import type { ComponentMeta } from "@kitsy/blu-schema";
import { ErrorCollector, err, ok, type Result } from "./result.js";

const URN_PATTERN = /^urn:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$/i;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
const VALID_CATEGORIES = new Set([
  "primitive",
  "layout",
  "ui",
  "form",
  "block",
  "template",
  "icon",
]);

export function validateComponentMeta(meta: unknown): Result<ComponentMeta> {
  const c = new ErrorCollector("");
  if (!isObject(meta)) {
    c.push("component-meta.shape.notObject", "ComponentMeta must be an object");
    return err(c.errors());
  }
  if (typeof meta.urn !== "string" || !URN_PATTERN.test(meta.urn)) {
    c.push(
      "component-meta.invalid.urn",
      "ComponentMeta.urn must be a URN like urn:blu:ui:button",
      "urn",
    );
  }
  if (typeof meta.displayName !== "string" || meta.displayName.length === 0) {
    c.push(
      "component-meta.missing.displayName",
      "ComponentMeta.displayName is required",
      "displayName",
    );
  }
  if (typeof meta.description !== "string") {
    c.push(
      "component-meta.missing.description",
      "ComponentMeta.description is required (may be empty string)",
      "description",
    );
  }
  if (typeof meta.category !== "string" || !VALID_CATEGORIES.has(meta.category)) {
    c.push(
      "component-meta.invalid.category",
      "ComponentMeta.category must be one of: primitive, layout, ui, form, block, template, icon",
      "category",
    );
  }
  if (typeof meta.version !== "string" || !SEMVER_PATTERN.test(meta.version)) {
    c.push(
      "component-meta.invalid.version",
      "ComponentMeta.version must be a semver string",
      "version",
    );
  }
  if (!isObject(meta.props) || (meta.props as Record<string, unknown>).type !== "object") {
    c.push(
      "component-meta.invalid.props",
      "ComponentMeta.props must be a PropSchema with type: 'object'",
      "props",
    );
  } else {
    const properties = (meta.props as Record<string, unknown>).properties;
    if (!isObject(properties)) {
      c.push(
        "component-meta.props.missing.properties",
        "ComponentMeta.props.properties must be an object",
        "props.properties",
      );
    }
  }
  if (c.hasErrors()) return err(c.errors());
  return ok(meta as unknown as ComponentMeta);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
