import type { Binding, PropValue } from "./value.js";
import type { Condition } from "./condition.js";
import type { Action } from "./action.js";

/**
 * A ViewNode is a component invocation expressed as data.
 *
 * Props are values; bindings are live reads from projections, data sources,
 * or form state. When rendered, the runtime resolves bindings through the
 * slate, subscribes the view to the relevant projections, and re-renders
 * on change.
 *
 * See `docs/blu/specification.md` §11.
 */
export interface ViewNode {
  /** Component URN, e.g. `urn:blu:ui:card`. */
  component: string;
  /** Static or shorthand-bound prop values. */
  props?: Record<string, PropValue>;
  /** Explicit bindings, indexed by prop name. */
  bindings?: Record<string, Binding>;
  /** Conditional rendering. The node is omitted when the condition is false. */
  when?: Condition;
  /** Iteration directive. The subtree renders once per item. */
  repeat?: RepeatDirective;
  /** Event-name → Action map. */
  actions?: Record<string, Action>;
  /** Child nodes. */
  children?: ViewNode[];
  /** Stable id for devtools and testing. */
  id?: string;
}

/**
 * Iteration over a binding that resolves to an array.
 *
 * See `docs/blu/specification.md` §11.1.
 */
export interface RepeatDirective {
  /** Must resolve to an iterable. */
  over: Binding;
  /** Variable name made available to the subtree (`{ $bind: "<as>.id" }`). */
  as: string;
  /** Optional dotted path into each item to use as the React key. */
  key?: string;
  /** Optional filter applied per item. */
  when?: Condition;
}

/**
 * A reference to a view defined elsewhere — typically the entry view of an
 * application or a route target.
 */
export interface ViewReference {
  /** Inline view tree. */
  inline?: ViewNode;
  /** URN of a registered view. */
  ref?: string;
}
