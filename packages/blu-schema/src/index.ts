/**
 * @kitsy/blu-schema — Layer 1 schema vocabulary.
 *
 * Types-only package. Re-exports every shape that authoring surfaces and
 * the runtime agree on. See `docs/blu/specification.md` §10–§15.
 */

export type { ApplicationConfiguration } from "./application.js";
export type { ViewNode, RepeatDirective, ViewReference } from "./view-node.js";
export type {
  Value,
  PropValue,
  Binding,
  BindingRef,
  NamedRef,
} from "./value.js";
export type { Condition } from "./condition.js";
export type {
  Action,
  NavigateAction,
  EmitAction,
  FormAction,
  CompositeAction,
} from "./action.js";
export type {
  FormDefinition,
  FormField,
  FieldValidation,
  ValidationRule,
} from "./form.js";
export type {
  DataSource,
  RestDataSource,
  GraphQLDataSource,
  StaticDataSource,
  BusDataSource,
  ProjectionDataSource,
  DataSourceRegistration,
} from "./data-source.js";
export type {
  ComponentMeta,
  ComponentCategory,
  PropSchema,
  PropFieldSchema,
  SchemaCommon,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  EnumSchema,
  ArraySchema,
  ObjectSchema,
  RefSchema,
  EventSchema,
  SlotSchema,
} from "./component-meta.js";
export type { RouteTable, RouteEntry } from "./route.js";
export type {
  ThemeConfiguration,
  ColorScale,
  TypographyConfiguration,
} from "./theme.js";
export type {
  PrimaryKind,
  PresenterKind,
  OverlayKind,
  ShellTheme,
  ShellDensity,
  PresenterInstance,
  OverlayInstance,
  ShellState,
  ShellOverlayDeclaration,
  ShellConfiguration,
} from "./shell.js";
export type {
  ProjectionRegistration,
  EventRegistration,
} from "./registration.js";
