import type { Action } from "@kitsy/blu-schema";
import { isDurability, isEventClass } from "@kitsy/blu-core";
import { ErrorCollector, err, ok, type Result } from "./result.js";

const KNOWN_KINDS = new Set(["navigate", "emit", "form", "composite"]);
const FORM_OPS = new Set(["submit", "reset", "setField", "validate"]);

/**
 * Validates a single declarative `Action`. Recurses into composite steps.
 */
export function validateAction(action: unknown): Result<Action> {
  const c = new ErrorCollector("");
  validateActionInto(action, c);
  if (c.hasErrors()) return err(c.errors());
  return ok(action as Action);
}

export function validateActionInto(
  action: unknown,
  c: ErrorCollector,
): void {
  if (!isObject(action)) {
    c.push("action.shape.notObject", "Action must be an object");
    return;
  }
  const kind = action.kind;
  if (typeof kind !== "string" || !KNOWN_KINDS.has(kind)) {
    c.push(
      "action.invalid.kind",
      `Action.kind must be one of: navigate, emit, form, composite (got ${String(kind)})`,
      "kind",
    );
    return;
  }
  switch (kind) {
    case "navigate":
      if (!isStringOrBinding(action.to)) {
        c.push("action.navigate.invalid.to", "navigate.to must be a string or Binding", "to");
      }
      break;

    case "emit": {
      if (typeof action.type !== "string" || action.type.length === 0) {
        c.push("action.emit.missing.type", "emit.type must be a non-empty string", "type");
      }
      if (action.class !== undefined && !isEventClass(action.class)) {
        c.push("action.emit.invalid.class", "emit.class must be a valid EventClass when present", "class");
      }
      if (action.durability !== undefined && !isDurability(action.durability)) {
        c.push(
          "action.emit.invalid.durability",
          "emit.durability must be a valid Durability when present",
          "durability",
        );
      }
      break;
    }

    case "form":
      if (typeof action.form !== "string" || action.form.length === 0) {
        c.push("action.form.missing.form", "form.form must be a non-empty string", "form");
      }
      if (typeof action.op !== "string" || !FORM_OPS.has(action.op)) {
        c.push(
          "action.form.invalid.op",
          "form.op must be one of: submit, reset, setField, validate",
          "op",
        );
      }
      if (action.op === "setField") {
        if (typeof action.field !== "string" || action.field.length === 0) {
          c.push(
            "action.form.setField.missing.field",
            "form.field is required when op is 'setField'",
            "field",
          );
        }
        if (action.value === undefined) {
          c.push(
            "action.form.setField.missing.value",
            "form.value is required when op is 'setField'",
            "value",
          );
        }
      }
      break;

    case "composite": {
      const steps = action.steps;
      if (!Array.isArray(steps) || steps.length === 0) {
        c.push(
          "action.composite.missing.steps",
          "composite.steps must be a non-empty array",
          "steps",
        );
      } else {
        steps.forEach((step, i) => validateActionInto(step, c.child("steps").child(i)));
      }
      if (action.onError !== undefined) {
        validateActionInto(action.onError, c.child("onError"));
      }
      break;
    }
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
