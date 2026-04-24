import type { EventClass, Durability } from "@kitsy/blu-core";
import type { Binding, PropValue } from "./value.js";

/**
 * Actions are the bridge from a user interaction (click, submit, input)
 * to an event emission. Declared on `ViewNode.actions`.
 *
 * See `docs/blu/specification.md` §12.
 */
export type Action = NavigateAction | EmitAction | FormAction | CompositeAction;

/** Navigate to another route. */
export interface NavigateAction {
  kind: "navigate";
  to: string | Binding;
  replace?: boolean;
  state?: Record<string, unknown>;
}

/** Emit a bus event. The default class is `intent`. */
export interface EmitAction {
  kind: "emit";
  /** Event type, e.g. `cart:item:add-requested`. */
  type: string;
  /** Defaults to `"intent"`. */
  class?: EventClass;
  /** Resolved at emission time; bindings are evaluated against the live slate. */
  payload?: Record<string, PropValue>;
  /** Overrides the event type's registered default tier. */
  durability?: Durability;
}

/** Operate on a form scoped projection. */
export interface FormAction {
  kind: "form";
  op: "submit" | "reset" | "setField" | "validate";
  /** Form id. */
  form: string;
  /** Required for `setField`. */
  field?: string;
  /** Required for `setField`. */
  value?: PropValue;
}

/** Sequential action composition with a per-failure handler. */
export interface CompositeAction {
  kind: "composite";
  steps: Action[];
  onError?: Action;
}
