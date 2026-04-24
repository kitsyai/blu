import type { Value } from "./value.js";

/**
 * Conditions are data — serializable, inspectable in devtools, testable in
 * isolation. There is no escape hatch to arbitrary code in a ViewNode;
 * conditions compose only from the operators below.
 *
 * See `docs/blu/specification.md` §11.2.
 */
export type Condition =
  | { $eq: [Value, Value] }
  | { $neq: [Value, Value] }
  | { $gt: [Value, Value] }
  | { $gte: [Value, Value] }
  | { $lt: [Value, Value] }
  | { $lte: [Value, Value] }
  | { $in: [Value, Value[]] }
  | { $and: Condition[] }
  | { $or: Condition[] }
  | { $not: Condition }
  | { $truthy: Value }
  | { $empty: Value };
