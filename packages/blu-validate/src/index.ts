/**
 * @kitsy/blu-validate — runtime validation for Blu primitives and schema.
 *
 * Pure functions that return `Result<T>` objects. Never throws on invalid
 * data; only on programming errors (which the caller should not catch).
 */

export type { Result, ValidationError } from "./result.js";
export { ok, err, makeError, ErrorCollector } from "./result.js";

export { validateEvent, validatePartialEvent } from "./event.js";
export { validateAction } from "./action.js";
export { validateViewNode } from "./view-node.js";
export { validateDataSource } from "./data-source.js";
export { validateFormDefinition } from "./form.js";
export { validateComponentMeta } from "./component-meta.js";
export { validateApplicationConfiguration } from "./application.js";
