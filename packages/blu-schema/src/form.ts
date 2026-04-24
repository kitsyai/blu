import type { Binding } from "./value.js";
import type { Action } from "./action.js";
import type { Condition } from "./condition.js";

/**
 * A form is a structured binding between input components and a form
 * projection. Each form has its own scoped projection (`form:{id}`) that
 * is `local-authoritative` by default.
 *
 * See `docs/blu/specification.md` §13.
 */
export interface FormDefinition {
  id: string;
  fields: Record<string, FormField>;
  validation?: ValidationRule[];
  submitAction?: Action;
}

/** Per-field shape declaration. */
export interface FormField {
  type: "text" | "number" | "boolean" | "date" | "select" | "multiselect" | "file";
  required?: boolean;
  default?: unknown;
  /** Choice list for `select` and `multiselect`. */
  enum?: Array<{ value: unknown; label: string }>;
  validation?: FieldValidation;
  /** Two-way bind: reads from and writes to a projection or context value. */
  bind?: Binding;
}

/** Field-level validation. */
export interface FieldValidation {
  /** RegExp pattern as a string (compiled at evaluation time). */
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** URN of a registered named validator. */
  custom?: string;
}

/** Form-level validation rule. Failure surfaces alongside field errors. */
export interface ValidationRule {
  /** Stable identifier for the rule. */
  id: string;
  /** Condition that, when true, is considered a violation. */
  when: Condition;
  /** Human-readable message. */
  message: string;
  /** Field ids implicated by the rule. */
  affects?: string[];
}
