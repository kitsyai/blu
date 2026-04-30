import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { useBus, useSlate, type DataSourceState } from "@kitsy/blu-context";
import type { Authority, BluEvent, PartialEvent } from "@kitsy/blu-core";
import type {
  Action,
  Binding,
  BindingRef,
  ComponentMeta,
  CompositeAction,
  Condition,
  DataSourceRegistration,
  FormAction,
  FormDefinition,
  NamedRef,
  PropValue,
  Value,
  ViewNode,
} from "@kitsy/blu-schema";

type ScopeValues = Readonly<Record<string, unknown>>;
type NamedValues = Readonly<Record<string, unknown>>;
type ContextValues = Readonly<Record<string, unknown>>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type SourceKind = "projection" | "data" | "form";

interface SourceDescriptor {
  kind: SourceKind;
  name: string;
}

interface ComponentRegistration {
  component: ComponentType<Record<string, unknown>>;
  meta: ComponentMeta;
}

interface ViewRuntime {
  executeAction: (
    action: Action,
    frame: ActionFrame,
    event: unknown,
  ) => Promise<void>;
}

interface ActionFrame {
  node: ViewNode;
  sourceValues: Readonly<Record<string, unknown>>;
  scope: ScopeValues;
}

interface FormValidationResult {
  errors: Readonly<Record<string, readonly string[]>>;
  formErrors: readonly string[];
  valid: boolean;
}

interface FormState {
  values: Readonly<Record<string, unknown>>;
  errors: Readonly<Record<string, readonly string[]>>;
  formErrors: readonly string[];
  valid: boolean;
  touched: Readonly<Record<string, boolean>>;
  submitting: boolean;
  submitCount: number;
  submittedAt?: number;
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
  dataSources?: readonly DataSourceRegistration[];
  forms?: readonly FormDefinition[];
  fetcher?: FetchLike;
  onNavigate?: (
    to: string,
    options: {
      replace?: boolean;
      state?: Record<string, unknown>;
    },
  ) => void | Promise<void>;
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
const EMPTY_DATA_SOURCES: readonly DataSourceRegistration[] = Object.freeze([]);
const EMPTY_FORMS: readonly FormDefinition[] = Object.freeze([]);
const RUNTIME_EMITTER = "urn:blu:view:runtime";

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
 * The renderer resolves props, explicit bindings, actions, conditions, repeat
 * directives, forms, and data sources.
 */
export function View({
  node,
  registry,
  refs = EMPTY_OBJECT,
  context = EMPTY_OBJECT,
  dataSources = EMPTY_DATA_SOURCES,
  forms = EMPTY_FORMS,
  fetcher = globalThis.fetch,
  onNavigate,
}: ViewProps): ReactNode {
  const bus = useBus();
  const slate = useSlate();
  const refsRef = useRef(refs);
  const contextRef = useRef(context);
  const [, setRuntimeVersion] = useState(0);
  const formDefinitions = indexFormDefinitions(forms);

  refsRef.current = refs;
  contextRef.current = context;

  useEffect(() => {
    const unregisters: Array<() => void> = [];
    const refreshUnsubs: Array<() => void> = [];
    let active = true;

    for (const form of forms) {
      unregisters.push(registerFormProjection(slate, form));
    }

    for (const registration of dataSources) {
      const source = registration.source;
      if (source.kind === "static") {
        unregisters.push(registerStaticDataSource(slate, source));
        continue;
      }
      if (source.kind === "projection") {
        unregisters.push(registerProjectionDataSource(slate, source));
        continue;
      }
      if (source.kind === "rest") {
        unregisters.push(registerRestDataSource(slate, source));
        const refresh = () =>
          fetchRestDataSource({
            bus,
            source,
            refs: refsRef.current,
            context: contextRef.current,
            slate,
            fetcher,
            active: () => active,
          });
        if (registration.autoFetch !== false) {
          void refresh();
        }
        if (source.refreshOn !== undefined) {
          for (const eventType of source.refreshOn) {
            refreshUnsubs.push(
              bus.subscribe(eventType, () => {
                void refresh();
              }),
            );
          }
        }
      }
    }

    setRuntimeVersion((version) => version + 1);

    return () => {
      active = false;
      for (const unsubscribe of refreshUnsubs) {
        unsubscribe();
      }
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, [bus, dataSources, fetcher, forms, slate]);

  const runtime: ViewRuntime = {
    executeAction: (action, frame, event) =>
      executeAction(action, {
        bus,
        context: contextRef.current,
        event,
        fetcher,
        formDefinitions,
        frame,
        onNavigate,
        refs: refsRef.current,
        slate,
      }),
  };

  return (
    <RenderedViewNode
      node={node}
      registry={registry}
      refs={refs}
      context={context}
      scope={EMPTY_SCOPE}
      runtime={runtime}
    />
  );
}

function RenderedViewNode({
  node,
  registry,
  refs,
  context,
  scope,
  runtime,
}: {
  node: ViewNode;
  registry: ComponentRegistry;
  refs: NamedValues;
  context: ContextValues;
  scope: ScopeValues;
  runtime: ViewRuntime;
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
                runtime={runtime}
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
  Object.assign(
    resolvedProps,
    compileNodeActions(node, sourceValues, scope, runtime),
  );
  const children = renderChildren(
    node.children ?? EMPTY_CHILDREN,
    registry,
    refs,
    context,
    scope,
    runtime,
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
  runtime: ViewRuntime,
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
        runtime={runtime}
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

function compileNodeActions(
  node: ViewNode,
  sourceValues: Readonly<Record<string, unknown>>,
  scope: ScopeValues,
  runtime: ViewRuntime,
): Record<string, unknown> {
  const compiled: Record<string, unknown> = {};

  for (const [propName, action] of Object.entries(
    node.actions ?? EMPTY_OBJECT,
  )) {
    compiled[propName] = (event: unknown) => {
      if (propName === "onSubmit" && isPreventableEvent(event)) {
        event.preventDefault();
      }
      void runtime.executeAction(
        action as Action,
        {
          node,
          sourceValues,
          scope,
        },
        event,
      );
    };
  }

  return compiled;
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
  for (const action of Object.values(node.actions ?? EMPTY_OBJECT)) {
    collectActionSources(action as Action, scope, descriptors);
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

function collectActionSources(
  action: Action,
  scope: ScopeValues,
  descriptors: Map<string, SourceDescriptor>,
): void {
  if (action.kind === "navigate") {
    if (typeof action.to !== "string") {
      collectBindingSources(action.to, descriptors);
    }
    return;
  }

  if (action.kind === "emit") {
    for (const value of Object.values(action.payload ?? EMPTY_OBJECT)) {
      collectValueSources(value as Value, scope, descriptors);
    }
    return;
  }

  if (action.kind === "form") {
    if (action.value !== undefined) {
      collectValueSources(action.value as Value, scope, descriptors);
    }
    return;
  }

  for (const step of action.steps) {
    collectActionSources(step, scope, descriptors);
  }
  if (action.onError !== undefined) {
    collectActionSources(action.onError, scope, descriptors);
  }
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

function isPreventableEvent(
  event: unknown,
): event is { preventDefault: () => void } {
  return (
    typeof event === "object" &&
    event !== null &&
    "preventDefault" in event &&
    typeof event.preventDefault === "function"
  );
}

function indexFormDefinitions(
  forms: readonly FormDefinition[],
): ReadonlyMap<string, FormDefinition> {
  const indexed = new Map<string, FormDefinition>();
  for (const form of forms) {
    indexed.set(normalizeFormId(form.id), form);
  }
  return indexed;
}

function normalizeFormId(id: string): string {
  return id.startsWith("form:") ? id.slice("form:".length) : id;
}

function formProjectionName(id: string): string {
  return id.startsWith("form:") ? id : `form:${id}`;
}

function dataProjectionName(id: string): string {
  return id.startsWith("data:") ? id : `data:${id}`;
}

function registerFormProjection(
  slate: ReturnType<typeof useSlate>,
  form: FormDefinition,
): () => void {
  const name = formProjectionName(form.id);
  try {
    const handle = slate.registerProjection<FormState>({
      name,
      authority: "local-authoritative",
      initialState: createInitialFormState(form),
      eventFilter: (event) => event.type.startsWith(`${name}:`),
      reduce: (state, event) => reduceFormState(form, state, event),
    });
    return () => {
      handle.unregister();
    };
  } catch {
    return () => {};
  }
}

function createInitialFormState(form: FormDefinition): FormState {
  const values: Record<string, unknown> = {};
  for (const [fieldName, field] of Object.entries(form.fields)) {
    values[fieldName] = field.default ?? defaultValueForField(field.type);
  }

  return {
    values,
    errors: {},
    formErrors: [],
    valid: true,
    touched: {},
    submitting: false,
    submitCount: 0,
  };
}

function reduceFormState(
  form: FormDefinition,
  state: FormState,
  event: BluEvent,
): FormState {
  const name = formProjectionName(form.id);

  switch (event.type) {
    case `${name}:field-set`: {
      const payload = event.payload as { field?: string; value?: unknown };
      const field = payload.field;
      if (typeof field !== "string" || !(field in form.fields)) {
        return state;
      }
      const nextErrors = { ...state.errors };
      delete nextErrors[field];
      return {
        ...state,
        values: {
          ...state.values,
          [field]: payload.value,
        },
        errors: nextErrors,
        touched: {
          ...state.touched,
          [field]: true,
        },
        valid:
          state.formErrors.length === 0 &&
          Object.values(nextErrors).every((messages) => messages.length === 0),
      };
    }
    case `${name}:validated`: {
      const payload = event.payload as FormValidationResult;
      return {
        ...state,
        errors: payload.errors,
        formErrors: payload.formErrors,
        valid: payload.valid,
      };
    }
    case `${name}:reset`:
      return createInitialFormState(form);
    case `${name}:submit-started`:
      return {
        ...state,
        submitting: true,
      };
    case `${name}:submitted`:
      return {
        ...state,
        submitting: false,
        submitCount: state.submitCount + 1,
        submittedAt: event.timestamp,
      };
    case `${name}:submit-failed`:
      return {
        ...state,
        submitting: false,
      };
    default:
      return state;
  }
}

function defaultValueForField(
  type: FormDefinition["fields"][string]["type"],
): unknown {
  if (type === "boolean") {
    return false;
  }
  if (type === "multiselect") {
    return [];
  }
  return "";
}

function registerStaticDataSource(
  slate: ReturnType<typeof useSlate>,
  source: Extract<DataSourceRegistration["source"], { kind: "static" }>,
): () => void {
  const name = dataProjectionName(source.id);
  try {
    const handle = slate.registerProjection<DataSourceState<unknown>>({
      name,
      authority: source.authority ?? "local-authoritative",
      initialState: {
        status: "loaded",
        data: cloneValue(source.data),
        error: null,
        fetchedAt: Date.now(),
      },
      reduce: (state) => state,
    });
    return () => {
      handle.unregister();
    };
  } catch {
    return () => {};
  }
}

function registerProjectionDataSource(
  slate: ReturnType<typeof useSlate>,
  source: Extract<DataSourceRegistration["source"], { kind: "projection" }>,
): () => void {
  const name = dataProjectionName(source.id);
  try {
    const handle = slate.registerDerivedProjection<DataSourceState<unknown>>({
      name,
      authority: "derived-only",
      derivedFrom: [source.from],
      computeFrom: (sources) => ({
        status: "loaded",
        data:
          source.path === undefined
            ? sources[source.from]
            : deepGet(sources[source.from], getPathSegments(source.path)),
        error: null,
      }),
    });
    return () => {
      handle.unregister();
    };
  } catch {
    return () => {};
  }
}

function registerRestDataSource(
  slate: ReturnType<typeof useSlate>,
  source: Extract<DataSourceRegistration["source"], { kind: "rest" }>,
): () => void {
  const name = dataProjectionName(source.id);
  try {
    const handle = slate.registerProjection<DataSourceState<unknown>>({
      name,
      authority: source.authority ?? "server-authoritative",
      initialState: {
        status: "idle",
        data: null,
        error: null,
      },
      eventFilter: (event) =>
        event.type === `${name}:loading` ||
        event.type === `${name}:loaded` ||
        event.type === `${name}:errored`,
      reduce: (state, event) => {
        if (event.type === `${name}:loading`) {
          return {
            ...state,
            status: "loading",
            error: null,
          };
        }
        if (event.type === `${name}:loaded`) {
          const payload = event.payload as {
            data: unknown;
            fetchedAt: number;
          };
          return {
            status: "loaded",
            data: payload.data,
            error: null,
            fetchedAt: payload.fetchedAt,
          };
        }
        if (event.type === `${name}:errored`) {
          const payload = event.payload as { error: unknown };
          return {
            ...state,
            status: "error",
            error: payload.error,
          };
        }
        return state;
      },
    });
    return () => {
      handle.unregister();
    };
  } catch {
    return () => {};
  }
}

async function fetchRestDataSource(options: {
  bus: ReturnType<typeof useBus>;
  source: Extract<DataSourceRegistration["source"], { kind: "rest" }>;
  refs: NamedValues;
  context: ContextValues;
  slate: ReturnType<typeof useSlate>;
  fetcher: FetchLike;
  active: () => boolean;
}): Promise<void> {
  const { bus, source, refs, context, slate, fetcher, active } = options;
  const name = dataProjectionName(source.id);
  if (!active()) {
    return;
  }

  await emitRuntimeEvent(bus, {
    type: `${name}:loading`,
    class: "fact",
    durability: "observable",
    payload: {},
    emitter: RUNTIME_EMITTER,
  });

  try {
    const response = await fetcher(
      String(resolveDataSourceInput(source.url, refs, context, slate)),
      {
        method: source.method ?? "GET",
        headers: resolveHeaders(source.headers, refs, context, slate),
        body: resolveRequestBody(source.body, refs, context, slate),
      },
    );
    const data = await parseResponseBody(response);
    if (!active()) {
      return;
    }
    await emitRuntimeEvent(bus, {
      type: `${name}:loaded`,
      class: "fact",
      durability: "observable",
      payload: {
        data,
        fetchedAt: Date.now(),
      },
      emitter: RUNTIME_EMITTER,
    });
  } catch (error) {
    if (!active()) {
      return;
    }
    await emitRuntimeEvent(bus, {
      type: `${name}:errored`,
      class: "fact",
      durability: "observable",
      payload: {
        error: normalizeRuntimeError(error),
      },
      emitter: RUNTIME_EMITTER,
    });
  }
}

async function executeAction(
  action: Action,
  options: {
    bus: ReturnType<typeof useBus>;
    slate: ReturnType<typeof useSlate>;
    frame: ActionFrame;
    refs: NamedValues;
    context: ContextValues;
    formDefinitions: ReadonlyMap<string, FormDefinition>;
    onNavigate?: ViewProps["onNavigate"];
    fetcher: FetchLike;
    event: unknown;
  },
): Promise<void> {
  if (action.kind === "navigate") {
    await executeNavigateAction(action, options);
    return;
  }

  if (action.kind === "emit") {
    await executeEmitAction(action, options);
    return;
  }

  if (action.kind === "form") {
    await executeFormAction(action, options);
    return;
  }

  await executeCompositeAction(action, options);
}

async function executeNavigateAction(
  action: Extract<Action, { kind: "navigate" }>,
  options: {
    bus: ReturnType<typeof useBus>;
    frame: ActionFrame;
    refs: NamedValues;
    context: ContextValues;
    onNavigate?: ViewProps["onNavigate"];
  },
): Promise<void> {
  const to =
    typeof action.to === "string"
      ? action.to
      : String(
          resolveExplicitBinding(
            action.to,
            options.frame.sourceValues,
            options.frame.scope,
            options.refs,
            options.context,
          ) ?? "",
        );

  if (options.onNavigate !== undefined) {
    await options.onNavigate(to, {
      replace: action.replace,
      state: action.state,
    });
    return;
  }

  await emitRuntimeEvent(options.bus, {
    type: "router:navigated",
    class: "fact",
    durability: "observable",
    payload: {
      to,
      replace: action.replace ?? false,
      state: action.state ?? {},
    },
    emitter: options.frame.node.component,
  });
}

async function executeEmitAction(
  action: Extract<Action, { kind: "emit" }>,
  options: {
    bus: ReturnType<typeof useBus>;
    frame: ActionFrame;
    refs: NamedValues;
    context: ContextValues;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(action.payload ?? EMPTY_OBJECT)) {
    payload[key] = resolvePropValue(
      value as PropValue,
      options.frame.sourceValues,
      options.frame.scope,
      options.refs,
      options.context,
    );
  }

  await emitRuntimeEvent(options.bus, {
    type: action.type,
    class: action.class ?? "intent",
    durability: action.durability ?? "observable",
    payload,
    emitter: options.frame.node.component,
  });
}

async function executeFormAction(
  action: FormAction,
  options: {
    bus: ReturnType<typeof useBus>;
    slate: ReturnType<typeof useSlate>;
    frame: ActionFrame;
    refs: NamedValues;
    context: ContextValues;
    formDefinitions: ReadonlyMap<string, FormDefinition>;
    fetcher: FetchLike;
    event: unknown;
  },
): Promise<void> {
  const formId = normalizeFormId(action.form);
  const projectionName = formProjectionName(formId);
  const definition = options.formDefinitions.get(formId);
  if (definition === undefined) {
    return;
  }

  const readState = (): FormState => {
    try {
      return options.slate.getProjection<FormState>(projectionName);
    } catch {
      return createInitialFormState(definition);
    }
  };

  if (action.op === "setField") {
    const field = action.field;
    if (typeof field !== "string") {
      return;
    }
    const value =
      action.value !== undefined
        ? resolvePropValue(
            action.value,
            options.frame.sourceValues,
            options.frame.scope,
            options.refs,
            options.context,
          )
        : extractEventValue(options.event);
    await emitRuntimeEvent(options.bus, {
      type: `${projectionName}:field-set`,
      class: "fact",
      durability: "journaled",
      payload: {
        field,
        value,
      },
      emitter: options.frame.node.component,
    });
    return;
  }

  if (action.op === "reset") {
    await emitRuntimeEvent(options.bus, {
      type: `${projectionName}:reset`,
      class: "fact",
      durability: "journaled",
      payload: {},
      emitter: options.frame.node.component,
    });
    return;
  }

  const currentState = readState();
  const validation = validateFormState(definition, currentState);

  await emitRuntimeEvent(options.bus, {
    type: `${projectionName}:validated`,
    class: "fact",
    durability: "journaled",
    payload: validation,
    emitter: options.frame.node.component,
  });

  if (action.op === "validate") {
    return;
  }

  if (!validation.valid) {
    await emitRuntimeEvent(options.bus, {
      type: `${projectionName}:submit-failed`,
      class: "fact",
      durability: "journaled",
      payload: {},
      emitter: options.frame.node.component,
    });
    return;
  }

  await emitRuntimeEvent(options.bus, {
    type: `${projectionName}:submit-started`,
    class: "fact",
    durability: "journaled",
    payload: {},
    emitter: options.frame.node.component,
  });

  await emitRuntimeEvent(options.bus, {
    type: `${projectionName}:submitted`,
    class: "fact",
    durability: "journaled",
    payload: cloneValue(currentState.values),
    emitter: options.frame.node.component,
  });

  if (definition.submitAction === undefined) {
    return;
  }

  await executeAction(definition.submitAction, {
    ...options,
    fetcher: options.fetcher,
    frame: {
      ...options.frame,
      sourceValues: {
        ...options.frame.sourceValues,
        [projectionName]: {
          ...currentState,
          valid: true,
        },
      },
    },
  });
}

async function executeCompositeAction(
  action: CompositeAction,
  options: {
    bus: ReturnType<typeof useBus>;
    slate: ReturnType<typeof useSlate>;
    frame: ActionFrame;
    refs: NamedValues;
    context: ContextValues;
    formDefinitions: ReadonlyMap<string, FormDefinition>;
    onNavigate?: ViewProps["onNavigate"];
    fetcher: FetchLike;
    event: unknown;
  },
): Promise<void> {
  try {
    for (const step of action.steps) {
      await executeAction(step, options);
    }
  } catch (error) {
    if (action.onError === undefined) {
      throw error;
    }
    await executeAction(action.onError, options);
  }
}

function validateFormState(
  form: FormDefinition,
  state: FormState,
): FormValidationResult {
  const errors: Record<string, readonly string[]> = {};

  for (const [fieldName, field] of Object.entries(form.fields)) {
    const fieldErrors: string[] = [];
    const value = state.values[fieldName];

    if (field.required && isEmptyFieldValue(value)) {
      fieldErrors.push("This field is required.");
    }

    if (field.validation?.pattern !== undefined && typeof value === "string") {
      const pattern = new RegExp(field.validation.pattern);
      if (!pattern.test(value)) {
        fieldErrors.push("This field does not match the required pattern.");
      }
    }

    if (field.validation?.minLength !== undefined) {
      const length = getLength(value);
      if (length !== null && length < field.validation.minLength) {
        fieldErrors.push(`Minimum length is ${field.validation.minLength}.`);
      }
    }

    if (field.validation?.maxLength !== undefined) {
      const length = getLength(value);
      if (length !== null && length > field.validation.maxLength) {
        fieldErrors.push(`Maximum length is ${field.validation.maxLength}.`);
      }
    }

    if (field.validation?.min !== undefined && typeof value === "number") {
      if (value < field.validation.min) {
        fieldErrors.push(`Minimum value is ${field.validation.min}.`);
      }
    }

    if (field.validation?.max !== undefined && typeof value === "number") {
      if (value > field.validation.max) {
        fieldErrors.push(`Maximum value is ${field.validation.max}.`);
      }
    }

    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors;
    }
  }

  const formErrors: string[] = [];
  const sourceValues = {
    [formProjectionName(form.id)]: state,
  };

  for (const rule of form.validation ?? []) {
    if (
      evaluateCondition(
        rule.when,
        sourceValues,
        EMPTY_SCOPE,
        EMPTY_OBJECT,
        EMPTY_OBJECT,
      )
    ) {
      formErrors.push(rule.message);
      for (const fieldName of rule.affects ?? []) {
        const current = errors[fieldName] ?? [];
        errors[fieldName] = [...current, rule.message];
      }
    }
  }

  return {
    errors,
    formErrors,
    valid:
      formErrors.length === 0 &&
      Object.values(errors).every(
        (messages) => (messages as readonly string[]).length === 0,
      ),
  };
}

function isEmptyFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function getLength(value: unknown): number | null {
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length;
  }
  return null;
}

function extractEventValue(event: unknown): unknown {
  if (typeof event !== "object" || event === null) {
    return undefined;
  }
  if (!("target" in event)) {
    return undefined;
  }
  const target = event.target;
  if (!(target instanceof EventTarget)) {
    return undefined;
  }

  if (target instanceof HTMLInputElement) {
    if (target.type === "checkbox" || target.type === "radio") {
      return target.checked;
    }
    if (target.type === "number") {
      return target.value === "" ? "" : Number(target.value);
    }
    return target.value;
  }
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return target.value;
  }
  return undefined;
}

function resolveDataSourceInput(
  value: string | Binding,
  refs: NamedValues,
  context: ContextValues,
  slate: ReturnType<typeof useSlate>,
): unknown {
  if (typeof value === "string") {
    return value;
  }
  return resolveRuntimeBinding(value, refs, context, slate);
}

function resolveHeaders(
  headers: Record<string, string | Binding> | undefined,
  refs: NamedValues,
  context: ContextValues,
  slate: ReturnType<typeof useSlate>,
): HeadersInit | undefined {
  if (headers === undefined) {
    return undefined;
  }

  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    resolved[key] =
      typeof value === "string"
        ? value
        : String(resolveRuntimeBinding(value, refs, context, slate) ?? "");
  }
  return resolved;
}

function resolveRequestBody(
  body: PropValue | undefined,
  refs: NamedValues,
  context: ContextValues,
  slate: ReturnType<typeof useSlate>,
): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }
  const value = resolveRuntimeValue(body, refs, context, slate);
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function resolveRuntimeBinding(
  binding: Binding,
  refs: NamedValues,
  context: ContextValues,
  slate: ReturnType<typeof useSlate>,
): unknown {
  if (binding.source === "context") {
    return deepGet(context, getPathSegments(binding.path));
  }
  const name = getProjectionName(binding.path);
  if (name === null) {
    return binding.fallback;
  }
  try {
    const value = slate.getProjection(name);
    const resolved = deepGet(value, getPathSegments(binding.path).slice(1));
    return resolved === undefined ? binding.fallback : resolved;
  } catch {
    return binding.fallback;
  }
}

function resolveRuntimeValue(
  value: PropValue,
  refs: NamedValues,
  context: ContextValues,
  slate: ReturnType<typeof useSlate>,
): unknown {
  if (isNamedRef(value)) {
    return refs[value.$ref];
  }
  if (isBindingRef(value)) {
    return resolveRuntimeBindingRef(value, context, slate);
  }
  return value;
}

function resolveRuntimeBindingRef(
  value: BindingRef,
  context: ContextValues,
  slate: ReturnType<typeof useSlate>,
): unknown {
  const segments = getPathSegments(value.$bind);
  const [head, ...tail] = segments;
  if (head === undefined) {
    return undefined;
  }
  if (head in context) {
    return deepGet(context[head], tail);
  }
  try {
    return deepGet(slate.getProjection(head), tail);
  } catch {
    return undefined;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function emitRuntimeEvent<TPayload>(
  bus: ReturnType<typeof useBus>,
  partial: Omit<
    PartialEvent<TPayload>,
    "schemaVersion" | "scopePath" | "origin"
  >,
): Promise<BluEvent<TPayload>> {
  return bus.emit({
    ...partial,
    schemaVersion: 1,
    scopePath: "app/view",
    origin: "system",
  });
}

function normalizeRuntimeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : String(error);
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(value);
    } catch {
      return value;
    }
  }
  return value;
}
