import type { ViewNode } from "@kitsy/blu-schema";
import { ErrorCollector, err, ok, type Result } from "./result.js";
import { validateActionInto } from "./action.js";

const URN_PATTERN = /^urn:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$/i;

/**
 * Validates a `ViewNode` subtree. Recurses into children and validates
 * actions, bindings, repeat directives, and conditions structurally.
 */
export function validateViewNode(node: unknown): Result<ViewNode> {
  const c = new ErrorCollector("");
  validateViewNodeInto(node, c);
  if (c.hasErrors()) return err(c.errors());
  return ok(node as ViewNode);
}

export function validateViewNodeInto(node: unknown, c: ErrorCollector): void {
  if (!isObject(node)) {
    c.push("view.shape.notObject", "ViewNode must be an object");
    return;
  }
  const component = node.component;
  if (typeof component !== "string" || component.length === 0) {
    c.push(
      "view.missing.component",
      "ViewNode.component is required",
      "component",
    );
  } else if (!URN_PATTERN.test(component)) {
    c.push(
      "view.invalid.component",
      "ViewNode.component must be a URN like urn:blu:ui:button",
      "component",
    );
  }

  if (node.props !== undefined && !isObject(node.props)) {
    c.push(
      "view.invalid.props",
      "ViewNode.props must be an object when present",
      "props",
    );
  }

  if (node.bindings !== undefined) {
    if (!isObject(node.bindings)) {
      c.push(
        "view.invalid.bindings",
        "ViewNode.bindings must be an object when present",
        "bindings",
      );
    } else {
      for (const [name, binding] of Object.entries(node.bindings)) {
        validateBindingInto(binding, c.child("bindings").child(name));
      }
    }
  }

  if (node.actions !== undefined) {
    if (!isObject(node.actions)) {
      c.push(
        "view.invalid.actions",
        "ViewNode.actions must be an object when present",
        "actions",
      );
    } else {
      for (const [name, action] of Object.entries(node.actions)) {
        validateActionInto(action, c.child("actions").child(name));
      }
    }
  }

  if (node.repeat !== undefined) {
    const r = node.repeat as Record<string, unknown>;
    const rc = c.child("repeat");
    validateBindingInto(r.over, rc.child("over"));
    if (typeof r.as !== "string" || r.as.length === 0) {
      rc.push(
        "view.repeat.missing.as",
        "repeat.as must be a non-empty string",
        "as",
      );
    }
  }

  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      c.push(
        "view.invalid.children",
        "ViewNode.children must be an array when present",
        "children",
      );
    } else {
      node.children.forEach((child, i) =>
        validateViewNodeInto(child, c.child("children").child(i)),
      );
    }
  }
}

export function validateBindingInto(value: unknown, c: ErrorCollector): void {
  if (!isObject(value)) {
    c.push("binding.shape.notObject", "Binding must be an object");
    return;
  }
  const validSources = new Set(["projection", "data", "form", "context"]);
  if (typeof value.source !== "string" || !validSources.has(value.source)) {
    c.push(
      "binding.invalid.source",
      "Binding.source must be one of: projection, data, form, context",
      "source",
    );
  }
  if (typeof value.path !== "string" || value.path.length === 0) {
    c.push(
      "binding.missing.path",
      "Binding.path must be a non-empty string",
      "path",
    );
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
