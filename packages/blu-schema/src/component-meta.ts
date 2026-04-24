/**
 * Component registration metadata.
 *
 * Every component registered with the `ComponentRegistry` provides its
 * meta. The registry is the source of truth for the studio palette, the
 * Mind generator's prop schemas, and downstream type generation.
 *
 * See `docs/blu/specification.md` §15.
 */
export interface ComponentMeta {
  /** URN, e.g. `urn:blu:ui:button` or `urn:x:acme:marketing:hero`. */
  urn: string;
  displayName: string;
  description: string;
  category: ComponentCategory;
  /** Semver string. Bumped when prop shape changes. */
  version: string;
  props: PropSchema;
  /** Events the component may emit. Optional. */
  events?: EventSchema[];
  /** Children constraints, indexed by slot name. */
  slots?: SlotSchema[];
}

export type ComponentCategory =
  | "primitive"
  | "layout"
  | "ui"
  | "form"
  | "block"
  | "template"
  | "icon";

/**
 * JSON-Schema-compatible subset used to describe props. Authoring tools
 * (studio, Mind) consume this to render property panels and generate
 * type-safe instantiations.
 */
export interface PropSchema {
  type: "object";
  required?: string[];
  properties: Record<string, PropFieldSchema>;
  additionalProperties?: boolean;
}

export type PropFieldSchema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | EnumSchema
  | ArraySchema
  | ObjectSchema
  | RefSchema;

export interface SchemaCommon {
  description?: string;
  default?: unknown;
}

export interface StringSchema extends SchemaCommon {
  type: "string";
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  format?: "url" | "email" | "color" | "image" | "icon" | "urn";
}

export interface NumberSchema extends SchemaCommon {
  type: "number" | "integer";
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
}

export interface BooleanSchema extends SchemaCommon {
  type: "boolean";
}

export interface EnumSchema extends SchemaCommon {
  type: "enum";
  values: Array<{ value: unknown; label: string }>;
}

export interface ArraySchema extends SchemaCommon {
  type: "array";
  items: PropFieldSchema;
  minItems?: number;
  maxItems?: number;
}

export interface ObjectSchema extends SchemaCommon {
  type: "object";
  properties: Record<string, PropFieldSchema>;
  required?: string[];
}

/** Reference to another schema by URN, useful for shared shapes. */
export interface RefSchema extends SchemaCommon {
  type: "ref";
  ref: string;
}

/**
 * Description of an event a component may emit. Used by authoring tools
 * to surface the component's outgoing events.
 */
export interface EventSchema {
  /** Event type emitted by this component. */
  type: string;
  /** Class of the event. Defaults to `intent`. */
  class?: "intent" | "fact";
  /** Schema of the event payload. */
  payload?: PropSchema;
  description?: string;
}

/** Slot constraint for a component's children. */
export interface SlotSchema {
  /** Slot name; the default slot is `"default"`. */
  name: string;
  description?: string;
  /** URNs of components allowed in this slot. Empty means any. */
  allow?: string[];
  /** URNs of components disallowed even when `allow` is empty. */
  deny?: string[];
  /** Cardinality. */
  min?: number;
  max?: number;
}
