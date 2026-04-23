# Blu — Specification

**Status:** Canonical
**Scope:** Precise contracts for the primitives, the backbone, the schema, and the hooks. This is the reference document — every package implementation conforms to what is specified here.

Read `foundation.md` and `architecture.md` first.

---

## Table of contents

1. BluEvent envelope
2. Event classes
3. Durability tiers
4. Origin and causality
5. Projection contract
6. Authority declarations
7. Slate API
8. Bus API
9. Transport contract
10. Schema types
11. ViewNode
12. Actions
13. Forms
14. DataSource
15. Component Registry and URNs
16. Hook API for React
17. Error semantics
18. Versioning and the schema registry

---

## 1. BluEvent envelope

Every event in the system conforms to a single envelope.

```typescript
interface BluEvent<TPayload = unknown> {
  // Identity
  eventId: string;                    // ULID, globally unique
  type: string;                       // Namespaced: "cart:item:added"
  schemaVersion: number;              // Monotonic integer per event type

  // Classification
  class: EventClass;                  // intent | fact | system | projection | sync | devtools
  durability: Durability;             // ephemeral | observable | journaled | replicated

  // Payload
  payload: TPayload;

  // Context
  emitter: string;                    // URN or logical identity of the emitter
  scopePath: string;                  // Hierarchical path, e.g. "app/feature/cart"
  origin: Origin;                     // user | system | sync | replay | migration

  // Causality
  causationId: string | null;         // The event that directly caused this one
  correlationId: string;              // The transaction or user-action root

  // Timing
  timestamp: number;                  // Milliseconds since epoch
  sequence: number;                   // Monotonic per-slate sequence number
}
```

Every field is required except `causationId`, which is null only for events that are causal roots (user-originated, not caused by another event).

### 1.1 Type naming

Event types are lowercase, colon-separated, namespaced by module and entity:

```
{module}:{entity}:{action}
```

Examples: `cart:item:added`, `router:navigated`, `auth:session:expired`, `projection:cart-totals:recomputed`.

Past tense for facts (`added`, `navigated`). Present tense for intents (`cart:item:add-requested`, `router:navigate-requested`). The class field disambiguates further, but the convention aids readability.

### 1.2 schemaVersion

Every event type has a schemaVersion. Version 1 is the initial shape. A breaking change to the payload shape increments the version. The slate records the schemaVersion on every journaled event so replay against a newer runtime can upgrade old events through registered migration functions.

### 1.3 scopePath

The scopePath locates the emitter in the application's logical hierarchy. A component in the cart area of a checkout feature emits at `app/checkout/cart`. Projections can subscribe to events by scope path, which enables feature-local event boundaries without requiring separate bus instances.

---

## 2. Event classes

Six classes, fixed and not extensible. The class field is a type discriminator and a semantic contract.

| Class        | Meaning                                                          | Example                                      |
|--------------|------------------------------------------------------------------|----------------------------------------------|
| `intent`     | Something was requested; not yet a fact                          | `cart:item:add-requested`                    |
| `fact`       | Something actually happened; the intent succeeded or not         | `cart:item:added`, `cart:item:add-failed`    |
| `system`     | The runtime itself emitted this                                  | `slate:journal:compacted`                    |
| `projection` | A projection recomputed; observable by other projections         | `projection:cart-totals:recomputed`          |
| `sync`       | Transport activity                                                | `sync:event:replicated`, `sync:session:resumed` |
| `devtools`   | Tooling emitted this; never affects application state            | `devtools:recording:started`                 |

Rules:

- Intents may be denied. Facts are facts — once journaled they are not rewritten (compensation is a new fact).
- System, projection, sync, and devtools classes are emitted by the runtime. Application code does not emit these directly.
- Application code emits intents and receives facts. A handler that transforms an intent into a fact is called a **reducer-of-intents** in this system — it is a consumer that observes an intent, performs work, and emits a fact.

---

## 3. Durability tiers

```typescript
type Durability = "ephemeral" | "observable" | "journaled" | "replicated";
```

| Tier          | Lifecycle                                                               | Visible to                                      |
|---------------|-------------------------------------------------------------------------|-------------------------------------------------|
| `ephemeral`   | Dispatched, consumed, discarded                                         | Subscribers that observe synchronously          |
| `observable`  | Held in memory for the session                                          | Devtools, session replay                        |
| `journaled`   | Persisted locally (IndexedDB)                                           | Local replay, next session                      |
| `replicated`  | Persisted locally and offered to transports                             | Peer slates, servers                            |

Each event declares its tier at emission time. The runtime honors it: ephemeral events never reach the journal; replicated events are both journaled and handed to transports.

A given event type typically has a default tier, but the emission site can override. A `router:navigated` event might default to `observable` (no cross-session history needed) but be journaled in an application that wants back-button support across reloads.

---

## 4. Origin and causality

```typescript
type Origin = "user" | "system" | "sync" | "replay" | "migration";
```

- `user`: The event originated from a user interaction.
- `system`: The runtime emitted it autonomously (scheduler, lifecycle, recovery).
- `sync`: The event arrived via a transport from another slate.
- `replay`: The event is being re-dispatched during journal replay.
- `migration`: The event is being re-dispatched from an older schema version after a migration.

The `origin` field exists so projections can behave differently during replay or sync than during live user activity. A projection that triggers a side effect on user clicks should not re-trigger during replay; it reads the origin field and decides.

### 4.1 causationId and correlationId

- `causationId` points to the immediate parent event. If the user clicks "add to cart" and the intent event causes a fact event, the fact's causationId is the intent's eventId.
- `correlationId` is the root of the causal chain. Every event in a chain shares the same correlationId. This is what devtools uses to group events into a transaction view.

Any consumer that emits a derived event is **required** to preserve correlationId and set causationId to the event it is reacting to. Failure to do so is a framework-level error (devtools flags it; strict mode rejects it).

---

## 5. Projection contract

A projection is a registered function that produces a read-model.

```typescript
interface Projection<TState, TEvent extends BluEvent = BluEvent> {
  name: string;                                  // Unique identifier
  authority: Authority;                          // Where this projection's truth lives
  scope?: string;                                // Optional scope path filter
  eventFilter?: (event: BluEvent) => boolean;    // Optional predicate

  initialState: TState;
  reduce: (state: TState, event: TEvent) => TState;

  snapshot?: {
    serialize: (state: TState) => unknown;
    deserialize: (raw: unknown) => TState;
    interval?: number;                           // Snapshot every N events
  };
}
```

Rules:

- `reduce` is pure. Same state + same event → same output, always.
- Projections do not emit events, with one exception: the runtime may emit a `projection:{name}:recomputed` event of class `projection` after a reduction, for devtools and other projections to observe.
- A projection can read from other projections only by depending on them explicitly — dependencies are declared through a companion API (`derivedFrom`) not shown here for brevity, specified in the `blu-slate` package.
- Projections are memoized per state. Subscribers are notified only when the reduce output changes by identity or by shallow equality of the declared output shape.

### 5.1 Lifecycles

A projection goes through: `idle` → `hydrating` (if snapshot exists) → `live` → `compacting` (periodic). The slate emits `projection:{name}:lifecycle` system events for each transition.

### 5.2 Derived projections

A projection marked `derived-only` in authority is a pure function of other projections. It has no journal footprint and recomputes when its sources change. Derived projections are the right shape for computed views (`cart.totals`, `user.displayName`, `route.currentPath`).

---

## 6. Authority declarations

```typescript
type Authority =
  | "local-only"              // Never persisted, never synced; dies with the session
  | "local-authoritative"     // Truth is local; may be snapshotted for next session
  | "projection-authoritative"// Derived from local events; re-computable from journal
  | "browser-authoritative"   // Persisted in the browser across sessions
  | "server-authoritative"    // Server is the truth; local is a cached view
  | "derived-only";           // Pure function of other projections
```

Authority is enforced by the slate:

- Writes to a `server-authoritative` projection must be dispatched as intents and await a fact from the transport. A synchronous local-only mutation is rejected.
- `local-only` projections are never offered to transports, regardless of event durability.
- `derived-only` projections cannot declare their own reduce function — only a `computeFrom` function over other projections.

Authority is the contract that prevents silent drift. Every developer reading a projection knows where its truth lives from its declaration.

---

## 7. Slate API

```typescript
interface Slate {
  // Projection management
  registerProjection<T>(projection: Projection<T>): ProjectionHandle<T>;
  unregisterProjection(name: string): void;
  getProjection<T>(name: string): T;
  subscribeProjection<T>(name: string, listener: (state: T) => void): Unsubscribe;

  // Direct append (rarely used by application code; bus handles normal emission)
  append(event: BluEvent): Promise<void>;

  // Journal
  getJournal(filter?: JournalFilter): AsyncIterable<BluEvent>;
  snapshot(): Promise<SnapshotHandle>;
  compact(upTo: SnapshotHandle): Promise<void>;

  // Replay
  replay(from?: SnapshotHandle): Promise<void>;
}
```

Notes:

- `append` is awaitable because journaled and replicated events may perform I/O (IndexedDB, transport hand-off). Ephemeral and observable appends resolve synchronously.
- `getJournal` returns an async iterable rather than an array so consumers can stream without loading everything into memory.
- `compact` removes events up to a snapshot, replacing them with the snapshot marker. Compaction is configurable per projection.
- `replay` re-dispatches journal events with `origin: "replay"` to rebuild projection state. Used on cold start and in devtools.

---

## 8. Bus API

```typescript
interface Bus {
  emit<T>(event: PartialEvent<T>): Promise<BluEvent<T>>;

  subscribe(
    filter: EventFilter,
    handler: (event: BluEvent) => void | Promise<void>
  ): Unsubscribe;

  use(middleware: BusMiddleware): void;
}

type PartialEvent<T> = Omit<BluEvent<T>, "eventId" | "timestamp" | "sequence">
  & Partial<Pick<BluEvent<T>, "causationId" | "correlationId" | "scopePath" | "origin">>;
```

Notes:

- `emit` accepts a partial event; the bus fills in eventId, timestamp, sequence, and default values for optional fields. If the emitter is inside a handler for another event, the bus auto-fills causationId and correlationId from the surrounding context. Explicit values always win.
- `emit` returns the finalized event (including its envelope) as a promise. Application code typically ignores the return value; handlers that need to correlate a response use it.
- Middleware receives each event before subscribers and can mutate the envelope (but not the payload), annotate, validate, or short-circuit. Standard middleware includes: validation, authorization, logging, devtools tapping, and the slate append.

---

## 9. Transport contract

```typescript
interface Transport {
  name: string;                                  // e.g. "broadcast-channel", "websocket"

  // Offered when the slate has a replicated event. Return true if accepted.
  offer(event: BluEvent): boolean | Promise<boolean>;

  // Called by the transport when an incoming event arrives from a peer.
  receive(handler: (event: BluEvent) => void): Unsubscribe;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  status: "idle" | "connecting" | "connected" | "error" | "disconnected";
}
```

Transports live in `blu-wire`. They register with the slate through a transport registry; replicated events are offered to each registered transport in turn.

Transport routing is governed by envelope metadata. An event may include a `$destination` hint (opaque to the framework, meaningful to the transport) that narrows delivery.

### 9.1 Idempotency

Every transport guarantees idempotent delivery on the receiving side. The slate's append accepts duplicate eventIds without re-processing. This is how replay, reconnection, and multi-transport delivery stay safe.

### 9.2 Ordering

Within a single correlationId, events arrive in causal order from any single transport. Across correlationIds, the slate orders by sequence number as they arrive, and uses transport timestamps for tie-breaking only when sequence numbers collide from different slates (in which case deterministic slate-identity ordering resolves the conflict).

---

## 10. Schema types

The schema types in `blu-schema` are the shared vocabulary for every declarative surface.

```typescript
interface ApplicationConfiguration {
  id: string;
  name: string;
  version: string;
  entry: ViewReference;
  routes?: RouteTable;
  theme?: ThemeConfiguration;
  dataSources?: DataSourceRegistration[];
  projections?: ProjectionRegistration[];
  eventRegistry?: EventRegistration[];
}
```

An application is described by an `ApplicationConfiguration`. The runtime consumes this as data, registers projections and data sources, and mounts the entry view.

---

## 11. ViewNode

```typescript
interface ViewNode {
  component: string;                             // URN, e.g. "urn:blu:ui:card"
  props?: Record<string, PropValue>;             // Static or bound values
  bindings?: Record<string, Binding>;            // Projection reads
  when?: Condition;                              // Conditional rendering
  repeat?: RepeatDirective;                      // Iteration
  actions?: Record<string, Action>;              // Event emitters
  children?: ViewNode[];
  id?: string;                                   // For devtools and testing
}

type PropValue =
  | string | number | boolean | null
  | { $bind: string }                            // Binding shorthand
  | { $ref: string };                            // Reference to a named value

interface Binding {
  source: "projection" | "data" | "form" | "context";
  path: string;                                  // Dotted path into the source
  fallback?: unknown;
  transform?: string;                            // Named transform URN
}
```

A ViewNode is a component invocation expressed as data. Props are values; bindings are live reads from projections, data sources, or form state. When rendered, the runtime resolves bindings through the slate, subscribes the view to the relevant projections, and re-renders on change.

### 11.1 Repeat

```typescript
interface RepeatDirective {
  over: Binding;                                 // Must resolve to an iterable
  as: string;                                    // Variable name inside the subtree
  key?: string;                                  // Path to a stable key within each item
  when?: Condition;                              // Filter
}
```

### 11.2 Conditions

```typescript
type Condition =
  | { $eq: [Value, Value] }
  | { $neq: [Value, Value] }
  | { $and: Condition[] }
  | { $or: Condition[] }
  | { $not: Condition }
  | { $truthy: Value }
  | { $empty: Value };

type Value = unknown | { $bind: string } | { $ref: string };
```

Conditions are data. They are serializable, inspectable in devtools, and testable in isolation. There is no escape hatch to arbitrary code in a ViewNode — conditions compose from the operators above.

---

## 12. Actions

Actions are emitters declared on views. They are the bridge from a user interaction (click, submit, input) to an event emission.

```typescript
type Action =
  | NavigateAction
  | EmitAction
  | FormAction
  | CompositeAction;

interface NavigateAction {
  kind: "navigate";
  to: string | Binding;
  replace?: boolean;
  state?: Record<string, unknown>;
}

interface EmitAction {
  kind: "emit";
  type: string;                                  // Event type
  class?: EventClass;                            // Defaults to "intent"
  payload?: Record<string, PropValue>;
  durability?: Durability;                       // Overrides the type default
}

interface FormAction {
  kind: "form";
  op: "submit" | "reset" | "setField" | "validate";
  form: string;                                  // Form id
  field?: string;
  value?: PropValue;
}

interface CompositeAction {
  kind: "composite";
  steps: Action[];                               // Sequential, with failure semantics
  onError?: Action;
}
```

An action declared as `{ kind: "emit", type: "cart:item:add-requested", payload: { itemId: { $bind: "item.id" } } }` compiles, at runtime, to a `bus.emit(...)` call with the resolved payload. The author never writes the emission by hand for the common case.

---

## 13. Forms

Forms are a structured binding between inputs and a form projection.

```typescript
interface FormDefinition {
  id: string;
  fields: Record<string, FormField>;
  validation?: ValidationRule[];
  submitAction?: Action;
}

interface FormField {
  type: "text" | "number" | "boolean" | "date" | "select" | "multiselect" | "file";
  required?: boolean;
  default?: unknown;
  enum?: Array<{ value: unknown; label: string }>;
  validation?: FieldValidation;
  bind?: Binding;                                // Two-way: reads and writes
}
```

A form has its own scoped projection (`form:{id}`) that is `local-authoritative` by default. Every input bound to the form reads and writes through `FormAction` entries. Submission emits a `form:{id}:submitted` fact event.

---

## 14. DataSource

Data sources are how a Blu application pulls external data. They resolve to projections.

```typescript
type DataSource =
  | RestDataSource
  | GraphQLDataSource
  | StaticDataSource
  | BusDataSource
  | ProjectionDataSource;

interface RestDataSource {
  kind: "rest";
  id: string;
  url: string | Binding;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string | Binding>;
  body?: PropValue;
  refreshOn?: string[];                          // Event types that invalidate
  authority?: Authority;                         // Defaults to "server-authoritative"
}
```

A data source registration produces a projection of the same id. The projection state carries `{ status, data, error, fetchedAt }`. Views bind to `data:{id}` as they would bind to any other projection.

The `refreshOn` list defines which event types should invalidate the cached data. A `cart:item:added` fact might refresh the `data:cart-summary` projection, for example.

---

## 15. Component Registry and URNs

Components are addressed by URN.

```
urn:blu:{namespace}:{name}           # First-party component
urn:x:{vendor}:{namespace}:{name}    # Third-party component
```

Examples: `urn:blu:ui:button`, `urn:blu:grid:stack`, `urn:x:acme:marketing:hero`.

```typescript
interface ComponentMeta {
  urn: string;
  displayName: string;
  description: string;
  category: "primitive" | "layout" | "ui" | "form" | "block" | "template" | "icon";
  version: string;
  props: PropSchema;                             // JSON Schema subset
  events?: EventSchema[];                        // Events the component may emit
  slots?: SlotSchema[];                          // Children constraints
}
```

Every component registered with `ComponentRegistry` provides its meta. The registry is the source of truth for the studio palette, the Mind generator's prop schemas, and type generation.

---

## 16. Hook API for React

Application code interacts with the backbone through hooks. The hooks are the React binding for the primitives and always surface the real model — no wrappers around alternative mental models.

```typescript
// Emit an intent or fact event.
function useEmit(): <T>(event: PartialEvent<T>) => Promise<BluEvent<T>>;

// Read a projection. Re-renders on change.
function useProjection<T>(name: string): T;

// Read a data source projection specifically, with status typing.
function useDataSource<T>(id: string): DataSourceState<T>;

// Read and write a form.
function useForm(id: string): FormHandle;

// Observe the current route projection.
function useRoute(): RouteState;

// Subscribe to raw events. Rarely used; prefer projections.
function useEventSubscription(filter: EventFilter, handler: (e: BluEvent) => void): void;

// Access the slate directly. For advanced use.
function useSlate(): Slate;

// Access the bus directly. For advanced use.
function useBus(): Bus;
```

Convention:

- Components read via `useProjection` or `useDataSource`. They do not read from the journal.
- Components write via `useEmit`. They do not call projection reducers directly.
- `useSlate` and `useBus` are escape hatches. Their use outside library code is rare and reviewed.

---

## 17. Error semantics

Every failure in the runtime is itself an event. There is no thrown exception that escapes the framework without being recorded.

- Validation failures on `emit` produce a `bus:emission:rejected` event of class `system`.
- Transport failures produce `sync:transport:error` events.
- Projection errors produce `projection:{name}:errored` events; the projection is marked degraded until the next successful reduce.
- Schema loading errors produce `schema:load:failed` events.

Applications can subscribe to these events to surface errors in the UI, report to telemetry, or trigger recovery.

---

## 18. Versioning and the schema registry

The event registry and the component registry are both versioned. Two mechanisms:

- **Per-event schemaVersion.** Every event type records its schemaVersion. A migration function can be registered to upgrade an older event to the current shape when replayed.
- **Per-component version.** Each `ComponentMeta` has a semver. Breaking prop changes bump the major version. The studio and Mind use this to know which instances in a saved ViewNode need migration.

The schema registry is declared as part of `ApplicationConfiguration`. It is itself data, which means it can be inspected, diffed, and migrated like anything else in the system.

---

## 19. Related documents

- `docs/blu/foundation.md` — principles.
- `docs/blu/architecture.md` — layering and package map.
- `docs/blu/shell.md` — shell taxonomy.
- `docs/blu/execution.md` — phase one sprints.
- `docs/governance.md` — cross-track process.
- `docs/specs/blu-component-specifications.md` — detailed specification of every component URN (consumes the contracts defined here).
