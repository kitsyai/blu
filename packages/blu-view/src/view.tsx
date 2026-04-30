import {
  Fragment,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { useSlate } from "@kitsy/blu-context";
import type { ComponentMeta, Condition, ViewNode } from "@kitsy/blu-schema";
import type {
  Binding,
  BindingRef,
  NamedRef,
  PropValue,
  Value,
} from "@kitsy/blu-schema";

type ScopeValues = Readonly<Record<string, unknown>>;
type NamedValues = Readonly<Record<string, unknown>>;
type ContextValues = Readonly<Record<string, unknown>>;

type SourceKind = "projection" | "data" | "form";

interface SourceDescriptor {
  kind: SourceKind;
  name: string;
}

interface ComponentRegistration {
  component: ComponentType<Record<string, unknown>>;
  meta: ComponentMeta;
}

/** Entry returned from the registry for one URN. */
export interface RegisteredComponent {
  component: ComponentType<Record<string, unknown>>;
  meta: ComponentMeta;
}

/** Structural view of one registered component's metadata and implementation. */
export interface ComponentRegistryEntry extends RegisteredComponent {
  urn: string;
}

/** Props accepted by the root `View` renderer. */
export interface ViewProps {
  node: ViewNode;
  registry: ComponentRegistry;
  refs?: NamedValues;
  context?: ContextValues;
}

const EMPTY_OBJECT: Readonly<Record<string, unknown>> = Object.freeze({});
const EMPTY_CHILDREN: readonly ViewNode[] = Object.freeze(
  [],
) as readonly ViewNode[];
const EMPTY_SOURCE_VALUES = Object.freeze({}) as Readonly<
  Record<string, unknown>
>;
const EMPTY_SCOPE: ScopeValues = EMPTY_OBJECT;
const EMPTY_DESCRIPTORS: readonly SourceDescriptor[] = Object.freeze([]);

/**
 * Registry of URN-addressed React components plus their metadata.
 *
 * This is the source of truth for the renderer and for any higher-level tool
 * that needs to browse available components.
 */
export class ComponentRegistry {
  readonly #entries = new Map<string, ComponentRegistration>();

  /** Register one URN-addressed component. Existing registrations are replaced. */
  register<TProps extends Record<string, unknown>>(
    urn: string,
    component: ComponentType<TProps>,
    meta: ComponentMeta,
  ): this {
    this.#entries.set(urn, {
      component: component as unknown as ComponentType<Record<string, unknown>>,
      meta,
    });
    return this;
  }

  /** Return a registered component by URN, if present. */
  get(urn: string): RegisteredComponent | undefined {
    const entry = this.#entries.get(urn);
    if (entry === undefined) {
      return undefined;
    }
    return {
      component: entry.component,
      meta: entry.meta,
    };
  }

  /** Return true when the registry has a component for this URN. */
  has(urn: string): boolean {
    return this.#entries.has(urn);
  }

  /** Return every registered component's metadata. */
  getAllMeta(): ComponentMeta[] {
    return [...this.#entries.values()].map((entry) => entry.meta);
  }

  /** Return metadata for one category. */
  getByCategory(category: ComponentMeta["category"]): ComponentMeta[] {
    return this.getAllMeta().filter((meta) => meta.category === category);
  }

  /** Search registered metadata by URN, display name, or description. */
  search(query: string): ComponentMeta[] {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
      return this.getAllMeta();
    }

    return this.getAllMeta().filter((meta) => {
      const haystack =
        `${meta.urn} ${meta.displayName} ${meta.description}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }

  /** Return every registered entry including the implementation. */
  entries(): ComponentRegistryEntry[] {
    return [...this.#entries.entries()].map(([urn, entry]) => ({
      urn,
      component: entry.component,
      meta: entry.meta,
    }));
  }
}

/** Create a new empty component registry. */
export function createComponentRegistry(): ComponentRegistry {
  return new ComponentRegistry();
}

/**
 * Render one `ViewNode` tree against a component registry.
 *
 * The renderer resolves props, explicit bindings, conditions, and repeat
 * directives. Action wiring lands in Sprint 8.
 */
export function View({
  node,
  registry,
  refs = EMPTY_OBJECT,
  context = EMPTY_OBJECT,
}: ViewProps): ReactNode {
  return (
    <RenderedViewNode
      node={node}
      registry={registry}
      refs={refs}
      context={context}
      scope={EMPTY_SCOPE}
    />
  );
}

function RenderedViewNode({
  node,
  registry,
  refs,
  context,
  scope,
}: {
  node: ViewNode;
  registry: ComponentRegistry;
  refs: NamedValues;
  context: ContextValues;
  scope: ScopeValues;
}): ReactNode {
  const slate = useSlate();
  const sourceDescriptors = collectSourceDescriptors(node, scope);
  useSyncExternalStore(
    (onStoreChange: () => void) =>
      subscribeToSources(slate, sourceDescriptors, onStoreChange),
    () => createSourceSnapshotToken(slate, sourceDescriptors),
    () => createSourceSnapshotToken(slate, sourceDescriptors),
  );
  const sourceValues = readSourceValues(slate, sourceDescriptors);

  if (
    node.when !== undefined &&
    !evaluateCondition(node.when, sourceValues, scope, refs, context)
  ) {
    return null;
  }

  if (node.repeat !== undefined) {
    const repeatedNode: ViewNode = {
      ...node,
      repeat: undefined,
    };
    const items = resolveExplicitBinding(
      node.repeat.over,
      sourceValues,
      scope,
      refs,
      context,
    );

    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    return (
      <>
        {items.map((item, index) => {
          const itemScope = {
            ...scope,
            [node.repeat!.as]: item,
          };

          if (
            node.repeat!.when !== undefined &&
            !evaluateCondition(
              node.repeat!.when,
              sourceValues,
              itemScope,
              refs,
              context,
            )
          ) {
            return null;
          }

          return (
            <Fragment key={resolveRepeatKey(item, node.repeat!.key, index)}>
              <RenderedViewNode
                node={repeatedNode}
                registry={registry}
                refs={refs}
                context={context}
                scope={itemScope}
              />
            </Fragment>
          );
        })}
      </>
    );
  }

  const registration = registry.get(node.component);
  if (registration === undefined) {
    return renderUnknownComponent(node.component);
  }

  const resolvedProps = resolveNodeProps(
    node,
    sourceValues,
    scope,
    refs,
    context,
  );
  const children = renderChildren(
    node.children ?? EMPTY_CHILDREN,
    registry,
    refs,
    context,
    scope,
  );

  const Component = registration.component;
  return <Component {...resolvedProps}>{children}</Component>;
}

function renderChildren(
  children: readonly ViewNode[],
  registry: ComponentRegistry,
  refs: NamedValues,
  context: ContextValues,
  scope: ScopeValues,
): ReactNode {
  if (children.length === 0) {
    return undefined;
  }

  return children.map((child, index) => (
    <Fragment key={child.id ?? `${child.component}:${index}`}>
      <RenderedViewNode
        node={child}
        registry={registry}
        refs={refs}
        context={context}
        scope={scope}
      />
    </Fragment>
  ));
}

function resolveNodeProps(
  node: ViewNode,
  sourceValues: Readonly<Record<string, unknown>>,
  scope: ScopeValues,
  refs: NamedValues,
  context: ContextValues,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(node.props ?? EMPTY_OBJECT)) {
    resolved[name] = resolvePropValue(
      value as PropValue,
      sourceValues,
      scope,
      refs,
      context,
    );
  }

  for (const [name, binding] of Object.entries(node.bindings ?? EMPTY_OBJECT)) {
    resolved[name] = resolveExplicitBinding(
      binding as Binding,
      sourceValues,
      scope,
      refs,
      context,
    );
  }

  return resolved;
}

function subscribeToSources(
  slate: ReturnType<typeof useSlate>,
  descriptors: readonly SourceDescriptor[],
  onStoreChange: () => void,
): () => void {
  if (descriptors.length === 0) {
    return () => {};
  }

  const unsubscriptions = descriptors.map((descriptor) => {
    try {
      return slate.subscribeProjection(descriptor.name, () => {
        onStoreChange();
      });
    } catch {
      return () => {};
    }
  });

  return () => {
    for (const unsubscribe of unsubscriptions) {
      unsubscribe();
    }
  };
}

function readSourceValues(
  slate: ReturnType<typeof useSlate>,
  descriptors: readonly SourceDescriptor[],
): Readonly<Record<string, unknown>> {
  if (descriptors.length === 0) {
    return EMPTY_SOURCE_VALUES;
  }

  const values: Record<string, unknown> = {};
  for (const descriptor of descriptors) {
    if (Object.prototype.hasOwnProperty.call(values, descriptor.name)) {
      continue;
    }
    try {
      values[descriptor.name] = slate.getProjection(descriptor.name);
    } catch {
      values[descriptor.name] = undefined;
    }
  }
  return values;
}

function createSourceSnapshotToken(
  slate: ReturnType<typeof useSlate>,
  descriptors: readonly SourceDescriptor[],
): string {
  if (descriptors.length === 0) {
    return "";
  }

  return descriptors
    .map((descriptor) => {
      let value: unknown;
      try {
        value = slate.getProjection(descriptor.name);
      } catch {
        value = undefined;
      }
      return `${descriptor.kind}:${descriptor.name}=${serializeSnapshotValue(value)}`;
    })
    .join("|");
}

function collectSourceDescriptors(
  node: ViewNode,
  scope: ScopeValues,
): readonly SourceDescriptor[] {
  const descriptors = new Map<string, SourceDescriptor>();

  for (const value of Object.values(node.props ?? EMPTY_OBJECT)) {
    collectValueSources(value as Value, scope, descriptors);
  }
  for (const binding of Object.values(node.bindings ?? EMPTY_OBJECT)) {
    collectBindingSources(binding as Binding, descriptors);
  }
  if (node.when !== undefined) {
    collectConditionSources(node.when, scope, descriptors);
  }
  if (node.repeat !== undefined) {
    collectBindingSources(node.repeat.over, descriptors);
    if (node.repeat.when !== undefined) {
      collectConditionSources(
        node.repeat.when,
        {
          ...scope,
          [node.repeat.as]: undefined,
        },
        descriptors,
      );
    }
  }

  return descriptors.size === 0 ? EMPTY_DESCRIPTORS : [...descriptors.values()];
}

function collectConditionSources(
  condition: Condition,
  scope: ScopeValues,
  descriptors: Map<string, SourceDescriptor>,
): void {
  if ("$eq" in condition) {
    collectValueSources(condition.$eq[0], scope, descriptors);
    collectValueSources(condition.$eq[1], scope, descriptors);
    return;
  }
  if ("$neq" in condition) {
    collectValueSources(condition.$neq[0], scope, descriptors);
    collectValueSources(condition.$neq[1], scope, descriptors);
    return;
  }
  if ("$gt" in condition) {
    collectValueSources(condition.$gt[0], scope, descriptors);
    collectValueSources(condition.$gt[1], scope, descriptors);
    return;
  }
  if ("$gte" in condition) {
    collectValueSources(condition.$gte[0], scope, descriptors);
    collectValueSources(condition.$gte[1], scope, descriptors);
    return;
  }
  if ("$lt" in condition) {
    collectValueSources(condition.$lt[0], scope, descriptors);
    collectValueSources(condition.$lt[1], scope, descriptors);
    return;
  }
  if ("$lte" in condition) {
    collectValueSources(condition.$lte[0], scope, descriptors);
    collectValueSources(condition.$lte[1], scope, descriptors);
    return;
  }
  if ("$in" in condition) {
    collectValueSources(condition.$in[0], scope, descriptors);
    for (const value of condition.$in[1]) {
      collectValueSources(value, scope, descriptors);
    }
    return;
  }
  if ("$and" in condition) {
    for (const nested of condition.$and) {
      collectConditionSources(nested, scope, descriptors);
    }
    return;
  }
  if ("$or" in condition) {
    for (const nested of condition.$or) {
      collectConditionSources(nested, scope, descriptors);
    }
    return;
  }
  if ("$not" in condition) {
    collectConditionSources(condition.$not, scope, descriptors);
    return;
  }
  if ("$truthy" in condition) {
    collectValueSources(condition.$truthy, scope, descriptors);
    return;
  }
  if ("$empty" in condition) {
    collectValueSources(condition.$empty, scope, descriptors);
  }
}

function collectValueSources(
  value: Value,
  scope: ScopeValues,
  descriptors: Map<string, SourceDescriptor>,
): void {
  if (isBindingRef(value)) {
    const segments = getPathSegments(value.$bind);
    const name = segments[0];
    if (name === undefined || name in scope) {
      return;
    }
    descriptors.set(`projection:${name}`, {
      kind: "projection",
      name,
    });
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectValueSources(item, scope, descriptors);
    }
  }
}

function collectBindingSources(
  binding: Binding,
  descriptors: Map<string, SourceDescriptor>,
): void {
  if (binding.source === "context") {
    return;
  }

  const name = getProjectionName(binding.path);
  if (name === null) {
    return;
  }

  descriptors.set(`${binding.source}:${name}`, {
    kind: binding.source,
    name,
  });
}

/** Evaluate a data Condition against the current view scope and source values. */
export function evaluateCondition(
  condition: Condition,
  sourceValues: Readonly<Record<string, unknown>>,
  scope: ScopeValues = EMPTY_SCOPE,
  refs: NamedValues = EMPTY_OBJECT,
  context: ContextValues = EMPTY_OBJECT,
): boolean {
  if ("$eq" in condition) {
    return Object.is(
      resolveValue(condition.$eq[0], sourceValues, scope, refs, context),
      resolveValue(condition.$eq[1], sourceValues, scope, refs, context),
    );
  }
  if ("$neq" in condition) {
    return !Object.is(
      resolveValue(condition.$neq[0], sourceValues, scope, refs, context),
      resolveValue(condition.$neq[1], sourceValues, scope, refs, context),
    );
  }
  if ("$gt" in condition) {
    return compareValues(
      resolveValue(condition.$gt[0], sourceValues, scope, refs, context),
      resolveValue(condition.$gt[1], sourceValues, scope, refs, context),
      (left, right) => left > right,
    );
  }
  if ("$gte" in condition) {
    return compareValues(
      resolveValue(condition.$gte[0], sourceValues, scope, refs, context),
      resolveValue(condition.$gte[1], sourceValues, scope, refs, context),
      (left, right) => left >= right,
    );
  }
  if ("$lt" in condition) {
    return compareValues(
      resolveValue(condition.$lt[0], sourceValues, scope, refs, context),
      resolveValue(condition.$lt[1], sourceValues, scope, refs, context),
      (left, right) => left < right,
    );
  }
  if ("$lte" in condition) {
    return compareValues(
      resolveValue(condition.$lte[0], sourceValues, scope, refs, context),
      resolveValue(condition.$lte[1], sourceValues, scope, refs, context),
      (left, right) => left <= right,
    );
  }
  if ("$in" in condition) {
    const value = resolveValue(
      condition.$in[0],
      sourceValues,
      scope,
      refs,
      context,
    );
    const candidates = condition.$in[1].map((candidate: Value) =>
      resolveValue(candidate, sourceValues, scope, refs, context),
    );
    return candidates.some((candidate: unknown) => Object.is(candidate, value));
  }
  if ("$and" in condition) {
    return condition.$and.every((nested: Condition) =>
      evaluateCondition(nested, sourceValues, scope, refs, context),
    );
  }
  if ("$or" in condition) {
    return condition.$or.some((nested: Condition) =>
      evaluateCondition(nested, sourceValues, scope, refs, context),
    );
  }
  if ("$not" in condition) {
    return !evaluateCondition(
      condition.$not,
      sourceValues,
      scope,
      refs,
      context,
    );
  }
  if ("$truthy" in condition) {
    return Boolean(
      resolveValue(condition.$truthy, sourceValues, scope, refs, context),
    );
  }
  return isEmptyValue(
    resolveValue(condition.$empty, sourceValues, scope, refs, context),
  );
}

function resolvePropValue(
  value: PropValue,
  sourceValues: Readonly<Record<string, unknown>>,
  scope: ScopeValues,
  refs: NamedValues,
  context: ContextValues,
): unknown {
  return resolveValue(value, sourceValues, scope, refs, context);
}

function resolveExplicitBinding(
  binding: Binding,
  sourceValues: Readonly<Record<string, unknown>>,
  scope: ScopeValues,
  refs: NamedValues,
  context: ContextValues,
): unknown {
  const baseValue =
    binding.source === "context"
      ? deepGet(context, getPathSegments(binding.path))
      : deepGetSourceValue(sourceValues, binding.path);

  return baseValue === undefined ? binding.fallback : baseValue;
}

function resolveValue(
  value: Value,
  sourceValues: Readonly<Record<string, unknown>>,
  scope: ScopeValues,
  refs: NamedValues,
  context: ContextValues,
): unknown {
  if (isBindingRef(value)) {
    return resolveBindingRef(value, sourceValues, scope, context);
  }
  if (isNamedRef(value)) {
    return refs[value.$ref];
  }
  return value;
}

function resolveBindingRef(
  value: BindingRef,
  sourceValues: Readonly<Record<string, unknown>>,
  scope: ScopeValues,
  context: ContextValues,
): unknown {
  const segments = getPathSegments(value.$bind);
  if (segments.length === 0) {
    return undefined;
  }

  const [head, ...tail] = segments;
  if (head === undefined) {
    return undefined;
  }
  if (head in scope) {
    return deepGet(scope[head], tail);
  }
  if (head in context) {
    return deepGet(context[head], tail);
  }

  return deepGet(sourceValues[head], tail);
}

function deepGetSourceValue(
  sourceValues: Readonly<Record<string, unknown>>,
  path: string,
): unknown {
  const segments = getPathSegments(path);
  const projectionName = segments[0];
  if (projectionName === undefined) {
    return undefined;
  }

  return deepGet(sourceValues[projectionName], segments.slice(1));
}

function getProjectionName(path: string): string | null {
  const segments = getPathSegments(path);
  return segments[0] ?? null;
}

function getPathSegments(path: string): string[] {
  return path
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function deepGet(value: unknown, segments: readonly string[]): unknown {
  let current = value;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function compareValues(
  left: unknown,
  right: unknown,
  comparator: (left: number | string, right: number | string) => boolean,
): boolean {
  if (
    (typeof left !== "number" && typeof left !== "string") ||
    (typeof right !== "number" && typeof right !== "string")
  ) {
    return false;
  }
  return comparator(left, right);
}

function serializeSnapshotValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return String(value);
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

function resolveRepeatKey(
  item: unknown,
  keyPath: string | undefined,
  index: number,
): string {
  if (keyPath === undefined) {
    return String(index);
  }

  const resolved = deepGet(item, getPathSegments(keyPath));
  return resolved === undefined ? String(index) : String(resolved);
}

function renderUnknownComponent(urn: string): ReactNode {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <span data-testid="unknown-urn-fallback">Unknown component: {urn}</span>
  );
}

function isBindingRef(value: unknown): value is BindingRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "$bind" in value &&
    typeof value.$bind === "string"
  );
}

function isNamedRef(value: unknown): value is NamedRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "$ref" in value &&
    typeof value.$ref === "string"
  );
}
