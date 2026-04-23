# Blu / BluSlate Master Plan

## Title
**Blu / BluSlate — Event-First Application Architecture with Optional Externalized Slate**

---

## 1. Background

Modern frontend systems typically evolve through a familiar sequence:

1. **Pure view and internal state**
   - components start with local UI state
   - logic is close to the view
   - fast to build, easy to iterate

2. **Externalized state**
   - some state becomes useful beyond one component
   - state needs to survive navigation, page refresh, tab changes, or feature growth
   - logging, analytics, hydration, and replay start becoming important

3. **Remote synchronization**
   - browser state needs persistence
   - app state needs hydration from server
   - sync across devices, tabs, sessions, or collaborators becomes valuable

Most state systems force developers to think about step 2 too early. The architecture becomes store-first, reducer-first, or framework-first before the app actually needs it.

That introduces a familiar set of costs:
- boilerplate-heavy action/reducer wiring
- cognitive split between “view code” and “store code”
- premature centralization
- pressure to hoist too much state
- difficulty evolving from local concerns into durable concerns gradually

Blu / BluSlate is a response to that problem.

---

## 2. What We Are Solving

We want a system where:

- views can begin life as normal components with internal state
- components can emit structured events without requiring a state architecture first
- externalization of logic and state is **incremental**, not mandatory
- logging, analytics, navigation, orchestration, and persistence can observe the same event stream
- durable state is modeled as a **slate**: append-only notes over time
- read models can later be projected from the slate
- browser and server can participate in sync without forcing every component into a global-store model
- developers and AI code agents do not need to maintain two disconnected mental systems for every feature

In short:

> We do not want to start with state.  
> We want to start with **events**, and let state emerge only where it earns its place.

---

## 3. Core Idea

Blu is the **event fabric**.

BluSlate is the **optional append-only slate and projection system** layered on top of that event fabric.

A component can:
- keep logic internal
- emit intent and fact events
- remain completely unaware of whether anyone listens

A BluSlate boundary can:
- observe selected events
- append notes to the slate
- project read models from those notes
- hydrate or sync against browser/server storage
- expose derived state to components via hooks or props

This gives us a layered evolution path:

### Stage 1 — Local only
- component uses internal state
- component emits events
- nobody needs to read or persist anything yet

### Stage 2 — Write only
- BluSlate writes selected events or derived notes to browser slate
- no component needs to read from external state yet
- useful for logging, analytics, replay, auditing, and future migration

### Stage 3 — Read and write
- some components choose to consume projected state
- some remain fully local
- the read side becomes opt-in and granular

### Stage 4 — Sync and hydrate
- browser slate hydrates from server
- server receives append operations or compacted snapshots
- multi-tab / multi-device consistency becomes possible

---

## 4. Why “Slate” and Not “State”

The word **state** often implies a global mutable store and immediate ownership.

BluSlate intentionally shifts the mental model:

- a **slate** is a durable writing surface
- the app decides what to write, when to write, and where to project from it
- not every event becomes state
- not every note becomes a read model
- projections are derived and replaceable

This avoids prematurely treating every UI interaction as authoritative application state.

---

## 5. Principles

## 5.1 Event-first, not store-first
Components emit events whether or not a store exists.

## 5.2 State is optional and evolutionary
State begins local, and only some of it graduates outward.

## 5.3 Externalization is selective
Only selected events or derived facts are written to the slate.

## 5.4 Append-only by default
Durable writes are journaled as notes over time, preserving order and traceability.

## 5.5 Projection over mutation
Readable state is produced as a projection from notes, not treated as the event stream itself.

## 5.6 React remains first-class
Components stay React-like:
- local state remains valid
- external reads are explicit
- render logic stays separate from infrastructure concerns

## 5.7 Hierarchy matters
Slate boundaries can exist at different levels of the tree:
- app
- feature
- subtree
- page
- widget family

## 5.8 Causality is explicit
A consumer of one event may emit additional events, but those derived events must preserve causal links.

## 5.9 Effects are infrastructure, not render logic
Writing to browser/server, syncing, logging, or analytics are handled outside render purity.

## 5.10 Truth is contextual
The source of truth is not globally identical for every concern. Different concerns may have different authorities:
- transient UI truth
- local projected truth
- browser durable truth
- server durable truth

---

## 6. Working Model

## 6.1 Event lifecycle

A component may emit:
- **intent event** — something requested
- **fact event** — something actually happened
- optional local updates internally

Example:
- `theme/toggleRequested`
- component decides or a consumer decides
- `theme/toggled`

At this point, the event is only a signal.

## 6.2 Blu consumers

Any subsystem may consume the event:
- logger
- analytics
- navigator
- orchestrator
- BluSlate writer
- devtools recorder
- domain workflow handler

Some consumers may emit more events in response.

That is allowed, but the emitted events must record a causal parent.

## 6.3 Slate append

A BluSlate boundary may choose to append:
- original event
- normalized domain event
- derived note
- compaction snapshot marker
- sync checkpoint metadata

Appending is the durable boundary.

## 6.4 Projection

Read models are derived from slate notes:
- current theme
- authenticated user summary
- active cart
- wizard progress
- sidebar layout state
- unsynced changes
- derived feature flags

Components can choose to consume these projections through hooks or wrapper readers.

---

## 7. Causality and Spawned Events

A consumed event may trigger one or more derived events.

Example:
- `cart/itemAdded`
  - causes `analytics/cartItemAddedTracked`
  - causes `inventory/reservationRequested`
  - causes `ui/cartBadgeUpdated`
  - causes `projection/cartTotalsInvalidated`

This is acceptable only if the system preserves causal lineage.

Every event should be able to answer:
- what caused me?
- who emitted me?
- where was I observed?
- was I user-originated, system-originated, or replay-originated?

### Event relationship model

Each event should support:
- `eventId`
- `causationId` — immediate parent event
- `correlationId` — wider chain / transaction / user action
- `origin` — user | system | sync | replay | migration
- `emitter` — component/system identity
- `scopePath` — logical tree path
- `timestamp`
- `sequence`

This turns a raw event stream into a traceable event graph.

---

## 8. How This Is Different from Other Systems

## Compared with classic Redux
Blu / BluSlate differs in several ways:

- Redux is commonly store-first; Blu is event-first
- Redux typically centralizes state early; Blu allows state to emerge gradually
- Redux actions usually exist to drive reducers; Blu events may exist for many consumers, even without state
- Redux centers current store snapshot; BluSlate centers append-only notes and optional projections
- Redux encourages one strong global source; Blu allows contextual authorities by lifecycle stage

## Compared with event buses only
Blu is not “just an event bus” because it also defines:
- durable append model
- projection model
- hierarchy/boundaries
- sync/hydration pathway
- causality model
- devtools timeline story

## Compared with event sourcing
BluSlate borrows from event sourcing, but stays UI-friendly:
- not every UI event is durable
- local state remains legitimate
- projection is optional per subtree
- the model is designed for incremental adoption inside app development

## Compared with CQRS
BluSlate borrows the read/write separation:
- write side appends notes
- read side projects views of those notes

But this is a practical UI architecture, not enterprise CQRS for its own sake.

---

## 9. What We Deliberately Sacrificed

No architecture gets everything for free. Blu / BluSlate makes explicit trade-offs.

## 9.1 We sacrifice universal simplicity
The model is simple at the edge but sophisticated in the core.
Once durable writes, projections, sync, and causal chains exist, the runtime becomes more capable — and more complex.

## 9.2 We sacrifice the comfort of one global truth
A strict single-store story is easy to explain.
Blu instead accepts layered truth:
- local internal
- projected local durable
- browser durable
- server durable

This is more honest, but more nuanced.

## 9.3 We sacrifice some “magic convenience”
To preserve predictability:
- event schemas must be explicit
- source-of-truth rules must be documented
- projections must be deliberate
- sync must be versioned

## 9.4 We sacrifice naive replay
Replay is possible only for what is actually journaled and projected deterministically.
Ephemeral UI-only interactions may not be replayed unless specifically recorded.

## 9.5 We sacrifice lowest-possible runtime minimalism
Durability, causality, projection, and sync metadata all have cost:
- memory
- processing
- implementation complexity
- tooling work

---

## 10. Risks and Mitigations

## 10.1 Risk: Sync complexity

### Problem
Once browser and server both participate, sync becomes hard:
- ordering
- idempotency
- conflicts
- retries
- duplicate delivery
- offline gaps
- multi-tab and multi-device merges

### Mitigation
- use append-only operations with stable event IDs
- make server ingestion idempotent
- persist last acknowledged sequence / checkpoint
- model sync as protocol, not implicit mutation
- support local pending queue
- use compaction snapshots plus journal tails
- define conflict rules per projection domain
- separate transport acknowledgment from projection commitment

### Design stance
We do not pretend sync is free. We treat it as a first-class subsystem.

---

## 10.2 Risk: Hidden ownership

### Problem
A feature becomes dangerous when:
- component internal state believes it owns truth
- BluSlate projection also believes it owns truth
- server hydration rewrites it unexpectedly

This leads to drift and bugs.

### Mitigation
Every externally relevant field must declare one of:
- `local-only`
- `local-authoritative`
- `projection-authoritative`
- `browser-authoritative`
- `server-authoritative`
- `derived-only`

A component may mirror external state locally for UX, but ownership must be explicit.

### Design stance
Authority is declared, never assumed.

---

## 10.3 Risk: Over-logging

### Problem
If every event is journaled:
- logs become noisy
- replay becomes expensive
- sync becomes bloated
- DevTools become unreadable
- storage fills with low-value chatter

### Mitigation
Define event durability tiers:
- `ephemeral`
- `observable`
- `journaled`
- `replicated`

Allow BluSlate writers to filter by:
- event namespace
- durability tier
- scope path
- payload predicates
- sampling policy

Prefer journaling domain facts, not every UI micro-interaction.

### Design stance
Not every signal deserves durability.

---

## 10.4 Risk: Event schema sprawl

### Problem
Without discipline:
- event names drift
- payloads become inconsistent
- replay contracts break
- integrations become brittle
- AI agents generate divergent conventions

### Mitigation
- adopt namespaced taxonomy
- version event schemas
- define required metadata envelope
- generate types from registry
- lint event naming and payload contracts
- maintain event registry and docs
- reserve naming patterns for intent/fact/system/projection/sync events

### Design stance
Events are public contracts, not local implementation trivia.

---

## 11. Operational Guardrails

To keep the system healthy:

- record only what is worth reconstructing
- treat projections as disposable and rebuildable
- keep append operations immutable
- ensure spawned events preserve causation
- compact journals periodically
- separate user-originated from system-originated events
- make replay mode explicit
- make sync mode explicit
- make source-of-truth visible in docs and devtools

---

## 12. Trade-off Summary

## Benefits
- local-first development remains natural
- state becomes incremental, not mandatory
- one event contract serves many subsystems
- write-only adoption is possible before read-side adoption
- replayability and durability improve over time
- sync and hydration have a natural place in the architecture
- AI agents can work against one coherent event/slate model

## Costs
- more runtime sophistication than plain local state
- more discipline needed around schemas and ownership
- sync is non-trivial
- projections and compaction must be engineered well
- debugging needs good tooling to stay understandable

---

## 13. Recommended Positioning

Use Blu / BluSlate internally and externally as:

> **An event-first application architecture with optional append-only slate journaling and projected read models.**

Avoid describing it as only:
- “state management”
- “Redux replacement”
- “event bus”
- “CQRS frontend”

Those descriptions capture parts of it, but not the whole.

---

## 14. Final Architectural Summary

Blu / BluSlate starts from a simple truth:

- apps begin as views and local logic
- events are the earliest reusable contract
- durable state should be earned, not imposed
- projections should be derived, not confused with raw history
- sync, replay, and remote hydration should emerge from a disciplined journal model
- causality must remain visible as systems react and spawn more events

The result is a system that respects the real evolution of software:

**local → observed → journaled → projected → synced**

That is the central idea, and the reason Blu / BluSlate exists.
