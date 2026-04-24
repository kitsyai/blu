/**
 * A value that can appear inside a ViewNode prop or a Condition operand.
 * May be a literal, a binding shorthand, or a named reference.
 */
export type Value = unknown | BindingRef | NamedRef;

/** Inline binding shorthand: `{ $bind: "cart.totals.grand" }`. */
export interface BindingRef {
  $bind: string;
}

/** Reference to a named value registered with the runtime. */
export interface NamedRef {
  $ref: string;
}

/**
 * Allowable prop values. Literal scalars or one of the two reference forms.
 */
export type PropValue =
  | string
  | number
  | boolean
  | null
  | BindingRef
  | NamedRef;

/**
 * A live binding to a projection, data source, form, or context value.
 * Used in `ViewNode.bindings` for explicit, typed reads.
 */
export interface Binding {
  source: "projection" | "data" | "form" | "context";
  /** Dotted path into the source's state. */
  path: string;
  /** Returned when the path is undefined. */
  fallback?: unknown;
  /** URN of a named transform applied to the resolved value. */
  transform?: string;
}
