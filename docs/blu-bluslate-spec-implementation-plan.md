# Blu / BluSlate Final Spec and Implementation Plan

## Audience
This document is for Codex / implementation agents and human engineers building the first production-grade Blu / BluSlate runtime.

---

## 1. Scope

This spec defines:

- event taxonomy
- event envelope and causal metadata
- slate append contract
- projection model
- source-of-truth rules
- React hook API
- sync and compaction rules
- DevTools timeline model
- phased implementation plan

This is a **v1 production architecture**, not merely a prototype concept note.

---

## 2. Architectural Modules

Implement as separate modules/packages where practical:

- `@kitsy/blu-core`
  - event envelope
  - event bus
  - causal metadata
  - subscriptions
  - scope path utilities

- `@kitsy/blu-slate`
  - append-only journal
  - projections
  - snapshots
  - compaction
  - hydration
  - browser persistence adapters

- `@kitsy/blu-react`
  - providers
  - hooks
  - boundary components
  - selector subscriptions

- `@kitsy/blu-sync`
  - server sync protocol
  - checkpoints
  - merge rules
  - retry / idempotency

- `@kitsy/blu-devtools`
  - timeline
  - event graph inspection
  - projection inspection
  - replay controls

---

## 3. Event Taxonomy

## 3.1 Event classes

Every event must belong to one class:

### Intent event
A request, wish, command, or user/system intent.
Examples:
- `theme/toggleRequested`
- `auth/signInRequested`
- `cart/addItemRequested`

### Fact event
A domain fact that actually occurred.
Examples:
- `theme/toggled`
- `auth/signedIn`
- `cart/itemAdded`

### System event
Infrastructure/runtime behavior.
Examples:
- `slate/appended`
- `sync/checkpointCommitted`
- `projection/rebuilt`

### Projection event
A read-model lifecycle event.
Examples:
- `projection/themeUpdated`
- `projection/cartInvalidated`
- `projection/cartRebuilt`

### Sync event
Transport or replication lifecycle.
Examples:
- `sync/pushRequested`
- `sync/pushAccepted`
- `sync/pullApplied`

### Devtools/replay event
Tooling and simulation behavior.
Examples:
- `replay/started`
- `replay/paused`
- `replay/stepApplied`

---

## 3.2 Durability tiers

Each event must declare durability:

- `ephemeral` — do not journal; may still be observed live
- `observable` — available to subscribers/devtools; not durable by default
- `journaled` — eligible for slate append
- `replicated` — journaled and eligible for remote sync

Durability must be explicit, never inferred.

---

## 3.3 Naming convention

Use slash-separated namespaced identifiers.

Pattern:
`<domain>/<eventName>`

Examples:
- `theme/toggleRequested`
- `theme/toggled`
- `auth/sessionHydrated`
- `sync/pushAccepted`

Avoid:
- generic names like `change`, `update`, `clicked`
- view-only names without domain meaning
- unversioned ad hoc payload evolution

---

## 4. Event Envelope

All Blu events must use a standard envelope.

```ts
export type BluEventClass =
  | "intent"
  | "fact"
  | "system"
  | "projection"
  | "sync"
  | "devtools";

export type BluDurability =
  | "ephemeral"
  | "observable"
  | "journaled"
  | "replicated";

export interface BluEvent<TPayload = unknown, TMeta extends object = {}> {
  eventId: string;
  type: string;
  class: BluEventClass;
  durability: BluDurability;

  payload: TPayload;
  meta: TMeta;

  timestamp: number;
  sequence?: number;

  origin: "user" | "system" | "sync" | "replay" | "migration";
  emitter: {
    kind: "component" | "hook" | "projection" | "sync" | "devtools" | "system";
    id: string;
  };

  scopePath: string;

  causationId?: string;
  correlationId?: string;

  schemaVersion: number;
}
```

## Required rules
- `eventId` must be globally unique
- `correlationId` groups a larger chain
- `causationId` points to the immediate parent event that caused this event
- `scopePath` identifies the logical hierarchy path, not DOM path
- `schemaVersion` must increment when payload contract changes incompatibly

---

## 5. Causal Relationship Rules

Consumers may emit new events while handling an event.

This is allowed only if the runtime records the event chain.

## 5.1 Causal chain rules
When event B is spawned from event A:
- `B.causationId = A.eventId`
- `B.correlationId = A.correlationId ?? A.eventId`

If event C is later spawned from B:
- `C.causationId = B.eventId`
- `C.correlationId = B.correlationId`

## 5.2 Fan-out support
One consumed event may cause multiple child events.
DevTools must display this as a graph, not just a flat list.

## 5.3 Replay rule
Replay-generated spawned events must preserve original causal metadata if replaying history, or mark origin as `replay` if regenerated.

---

## 6. Slate Append Contract

A BluSlate boundary decides what to persist.

## 6.1 Appendable record types

```ts
export type BluSlateRecord =
  | BluSlateEventRecord
  | BluSlateSnapshotRecord
  | BluSlateCheckpointRecord
  | BluSlateCompactionRecord;

export interface BluSlateEventRecord {
  kind: "event";
  recordId: string;
  streamId: string;
  sequence: number;
  appendedAt: number;
  event: BluEvent;
}

export interface BluSlateSnapshotRecord<TState = unknown> {
  kind: "snapshot";
  recordId: string;
  streamId: string;
  sequence: number;
  appendedAt: number;
  projectionKey: string;
  state: TState;
  basedOnSequence: number;
}

export interface BluSlateCheckpointRecord {
  kind: "checkpoint";
  recordId: string;
  streamId: string;
  sequence: number;
  appendedAt: number;
  checkpointType: "local-sync" | "server-ack" | "hydration";
  checkpointValue: string;
}

export interface BluSlateCompactionRecord {
  kind: "compaction";
  recordId: string;
  streamId: string;
  sequence: number;
  appendedAt: number;
  compactedUntilSequence: number;
  snapshotRefs: string[];
}
```

## 6.2 Append rules
- append order is monotonic within a stream
- records are immutable after append
- event records are primary; snapshots/checkpoints are auxiliary
- each slate boundary owns one or more logical streams
- append must be atomic per stream

## 6.3 Filtering
A slate writer may filter by:
- event type
- class
- durability
- scopePath prefix
- custom predicate
- emitter kind
- origin

---

## 7. Projection Model

Projections derive readable state from slate records.

## 7.1 Projection properties
Each projection must define:
- `projectionKey`
- initial state
- event reducer
- optional snapshot serializer
- optional invalidation rules
- optional compaction participation

## 7.2 Projection interface

```ts
export interface BluProjection<TState = unknown> {
  projectionKey: string;
  initialState: TState;

  reduce(state: TState, event: BluEvent): TState;

  shouldConsume?(event: BluEvent): boolean;

  serializeSnapshot?(state: TState): unknown;
  deserializeSnapshot?(raw: unknown): TState;
}
```

## 7.3 Projection rules
- projection reduction must be pure
- projections must be rebuildable from journal + snapshot
- projections may ignore irrelevant events
- projection state is derived, not source history

## 7.4 Projection scopes
Support projection attachment at:
- app root
- subtree/feature
- page
- widget family

---

## 8. Source-of-Truth Rules

Every externally relevant field must declare an authority mode.

```ts
export type BluAuthority =
  | "local-only"
  | "local-authoritative"
  | "projection-authoritative"
  | "browser-authoritative"
  | "server-authoritative"
  | "derived-only";
```

## 8.1 Rules
- `local-only`: never externalized
- `local-authoritative`: source lives in component/hook; slate may mirror
- `projection-authoritative`: source is current projection state
- `browser-authoritative`: local durable state wins until server merge policy says otherwise
- `server-authoritative`: hydration/sync from server is canonical
- `derived-only`: never written directly; computed from other authoritative fields

## 8.2 Required documentation
Each feature that externalizes state must document:
- field name
- authority mode
- write path
- read path
- sync behavior
- conflict behavior

---

## 9. React Hook API

## 9.1 Provider components

```ts
interface BluProviderProps {
  bus: BluBus;
  children: React.ReactNode;
}

interface BluSlateProviderProps {
  slate: BluSlate;
  scopePath?: string;
  children: React.ReactNode;
}
```

## 9.2 Core hooks

```ts
function useBluEmit(): (event: BluEvent) => void;

function useBluScopePath(): string;

function useBluSlate<T>(
  selector: (state: BluProjectedRootState) => T,
  isEqual?: (a: T, b: T) => boolean
): T;

function useBluProjection<T>(
  projectionKey: string,
  selector: (state: T) => unknown,
  isEqual?: (a: unknown, b: unknown) => boolean
): unknown;

function useBluAppend(): (eventOrRecord: BluEvent | BluSlateRecord) => void;
```

## 9.3 Optional wrapper components

These are secondary conveniences, not the primary API.

```ts
interface BluSlateReaderProps<T> {
  projectionKey: string;
  select: (state: T) => Record<string, unknown>;
  children: React.ReactElement;
}
```

Behavior:
- reads projection state
- injects selected values into child props
- for pure presentational descendants

## 9.4 Implementation rules
- external subscriptions must use `useSyncExternalStore`
- hooks must avoid implicit broad subscriptions
- selectors must be memo-safe and stable
- projection subscriptions must be granular

---

## 10. Event Bus Runtime

## 10.1 Bus responsibilities
- publish event
- notify subscribers
- support ordered dispatch
- preserve metadata
- attach current scope path if missing
- allow middleware/observers
- support tracing mode

## 10.2 Subscriber interface

```ts
interface BluEventSubscriber {
  id: string;
  order?: number;
  canHandle?(event: BluEvent): boolean;
  handle(event: BluEvent, ctx: BluHandleContext): void | BluEvent | BluEvent[];
}
```

## 10.3 Spawn behavior
If `handle()` returns one or more new events:
- runtime wraps/normalizes them
- assigns causation/correlation metadata
- publishes them after current handler completion according to chosen scheduling policy

## 10.4 Scheduling policy
Default for v1:
- synchronous in-process dispatch queue
- breadth-first or FIFO child append, choose one and document it
- no unbounded recursive inline execution

Recommendation:
- use queue-based FIFO dispatch
- preserve deterministic ordering

---

## 11. Sync Rules

## 11.1 Sync model
Sync operates over journaled/replicated records, not arbitrary state mutation.

## 11.2 Required features
- local append queue
- last server-acknowledged sequence/checkpoint
- idempotent server ingestion by eventId/recordId
- pull/apply support for remote records
- hydration bootstrap path

## 11.3 Multi-tab support
Use browser broadcast coordination:
- BroadcastChannel when available
- storage/event fallback if necessary

Rules:
- one tab may act as sync leader, or all tabs may sync independently with idempotency
- tabs must converge on shared browser-authoritative records

## 11.4 Conflict policy
Per projection/feature define one:
- last-write-wins
- server-wins
- browser-wins
- merge by reducer/domain logic
- reject and surface conflict

Do not use one global conflict strategy for all domains.

---

## 12. Compaction Rules

Append-only logs need bounded growth.

## 12.1 Compaction triggers
- record count threshold
- byte size threshold
- idle-time maintenance
- successful server ack window
- projection-defined threshold

## 12.2 Compaction strategy
- produce projection snapshots
- emit compaction record
- retain tail journal after snapshot
- preserve ability to rebuild from latest snapshot + remaining tail

## 12.3 Retention classes
- keep forever
- compact aggressively
- compact after sync ack
- session-only

This should be configurable by projection/stream.

---

## 13. DevTools Timeline Model

## 13.1 Timeline goals
DevTools must make the architecture understandable.

Show:
- event list
- causal graph
- projection diffs
- append records
- sync checkpoints
- replay controls
- authority/source-of-truth annotations

## 13.2 Timeline entities

### Event node
Displays:
- type
- class
- durability
- emitter
- scopePath
- eventId
- causationId
- correlationId
- payload preview

### Projection update node
Displays:
- projection key
- before/after diff
- sequence range applied

### Append node
Displays:
- streamId
- record kind
- sequence
- sync eligibility

### Sync node
Displays:
- push/pull status
- checkpoint values
- acked range

## 13.3 Visualization
Provide two views:
- chronological timeline
- causal graph/tree

This is required because spawned events create fan-out chains not obvious in a flat list.

## 13.4 Replay support
- replay from sequence
- replay by correlationId
- replay by scopePath
- step forward/backward where feasible
- mark replay-originated events clearly

---

## 14. Phased Implementation Plan

## Phase 1 — Core event runtime
Build:
- event envelope types
- emit/publish runtime
- subscriber registry
- queue-based dispatch
- causal metadata propagation
- basic logger

Deliverable:
- deterministic event flow in tests
- spawned event chains supported

## Phase 2 — Basic browser slate
Build:
- append-only journal adapter
- in-memory + IndexedDB/localStorage adapter
- stream sequencing
- append filters
- event persistence tiers

Deliverable:
- journaled event stream stored locally
- reload-safe persistence

## Phase 3 — Projection engine
Build:
- projection registry
- reducer-based projection rebuild
- snapshot serialization
- selector subscription layer

Deliverable:
- readable external state from journal
- rebuild from journal on startup

## Phase 4 — React integration
Build:
- providers
- `useBluEmit`
- `useBluSlate`
- `useBluProjection`
- `BluSlateReader`

Deliverable:
- React-friendly consumption with explicit hooks
- subtree-based slate attachment

## Phase 5 — DevTools v1
Build:
- event timeline
- causal chain visualization
- projection state viewer
- append record viewer

Deliverable:
- inspectable runtime
- debugging beyond console logs

## Phase 6 — Multi-tab support
Build:
- BroadcastChannel coordination
- cross-tab append propagation
- shared checkpoint state
- duplicate suppression

Deliverable:
- convergent behavior across multiple browser tabs

## Phase 7 — Server sync
Build:
- push protocol
- pull protocol
- hydration bootstrap
- idempotent server ingestion
- per-feature conflict policy hooks

Deliverable:
- browser ↔ server slate sync
- durable multi-device story

## Phase 8 — Compaction and replay hardening
Build:
- snapshot compaction
- partial replay
- replay safety guards
- retention policies

Deliverable:
- bounded storage growth
- practical devtools replay

---

## 15. Initial Non-Goals

For v1, do not overreach into:
- full CRDT support everywhere
- automatic conflict resolution for all domains
- distributed collaboration for all projection types
- automatic schema migration without versioning plan
- magical inference of authority/source-of-truth

---

## 16. Acceptance Criteria

The first production-ready implementation is acceptable only if:

- components can emit events without any slate configured
- events can be observed by multiple subscribers
- subscribers can spawn additional events with preserved causation
- selected events can be appended durably to browser slate
- projections can rebuild deterministically from slate
- React components can read projections via hooks
- source-of-truth rules are documentable and enforceable
- logs can be compacted safely
- multi-tab propagation works
- server sync is idempotent
- DevTools can show both chronology and causal chains

---

## 17. Recommended Internal Terminology

Use these terms consistently:

- **Blu event** = emitted signal
- **Slate note** = durable appended record
- **Projection** = readable derived state
- **Authority** = current source-of-truth mode
- **Correlation** = larger action chain
- **Causation** = immediate parent relationship
- **Hydration** = initial state bootstrap from durable source
- **Compaction** = snapshot + tail retention process

Avoid using “state” alone when precision matters.

---

## 18. Final Build Guidance for Codex

When implementing, prioritize:
1. explicit contracts over convenience
2. deterministic ordering over clever async shortcuts
3. selective journaling over “log everything”
4. granular subscriptions over broad re-renders
5. visible causality over opaque side effects
6. typed registry-driven events over ad hoc strings
7. rebuildable projections over mutable hidden stores

The implementation should preserve the core promise of Blu / BluSlate:

> **Apps can start local and eventful, then gradually become journaled, projected, and synced — without forcing developers to abandon the natural React development model.**
