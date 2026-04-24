/**
 * Result type returned by every validator. Validators never throw on bad
 * input — they always return a Result.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

/**
 * A single validation error.
 */
export interface ValidationError {
  /** Dotted path into the input where the error was found (e.g. `routes[2].view`). */
  path: string;
  /** Stable machine-readable code, e.g. `envelope.missing.eventId`. */
  code: string;
  /** Human-readable explanation. */
  message: string;
}

/** Construct a successful Result. */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** Construct a failed Result from one or more errors. */
export function err<T>(errors: ValidationError[]): Result<T> {
  return { ok: false, errors };
}

/** Construct a single error. */
export function makeError(
  path: string,
  code: string,
  message: string,
): ValidationError {
  return { path, code, message };
}

/**
 * Builder used internally by validators to accumulate errors with a
 * stable path prefix without manual string concatenation.
 *
 * Child collectors created via `child()` share the same underlying error
 * array as their parent, so pushing on a child is visible from the root
 * without an explicit merge step.
 */
export class ErrorCollector {
  readonly #errors: ValidationError[];
  readonly #path: string;

  constructor(path = "", sink?: ValidationError[]) {
    this.#path = path;
    this.#errors = sink ?? [];
  }

  /** Push an error at the current path (or at a child of it). */
  push(code: string, message: string, child?: string | number): void {
    this.#errors.push({
      path: childPath(this.#path, child),
      code,
      message,
    });
  }

  /**
   * Return a child collector rooted at a deeper path. The child shares the
   * parent's error array — errors pushed on the child surface on the parent.
   */
  child(segment: string | number): ErrorCollector {
    return new ErrorCollector(childPath(this.#path, segment), this.#errors);
  }

  /** True if any errors were collected (including via descendants). */
  hasErrors(): boolean {
    return this.#errors.length > 0;
  }

  /** Snapshot of the accumulated errors. */
  errors(): ValidationError[] {
    return this.#errors.slice();
  }

  /** Merge errors returned by another collector or validator. */
  merge(source: ErrorCollector | ValidationError[] | Result<unknown>): void {
    if (Array.isArray(source)) {
      for (const e of source) this.#errors.push(e);
      return;
    }
    if (source instanceof ErrorCollector) {
      // Child collectors already share storage; only foreign collectors need copying.
      if (source.#errors === this.#errors) return;
      for (const e of source.errors()) this.#errors.push(e);
      return;
    }
    if (!source.ok) {
      for (const e of source.errors) this.#errors.push(e);
    }
  }
}

function childPath(parent: string, child: string | number | undefined): string {
  if (child === undefined) return parent;
  if (parent === "") return String(child);
  if (typeof child === "number") return `${parent}[${child}]`;
  return `${parent}.${child}`;
}
