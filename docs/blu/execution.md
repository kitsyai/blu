# Blu — Execution

**Status:** Canonical
**Scope:** The phase-one plan for building Blu from the primitives up. Sprint boundaries, gate criteria, and sequence.

Read `foundation.md`, `architecture.md`, and `specification.md` first. This document schedules what those documents specify.

---

## 1. Build strategy

Blu is built bottom-up. The primitives are authored before the backbone, the backbone before the integration layer, the integration layer before the view layer, and the view layer before the authoring surface. Every sprint ends with a working system that exercises the layer it just completed.

The strategy rests on three non-negotiables:

- **No layer is built against a stubbed lower layer.** If sprint 3 needs the slate, it waits for sprint 2 to complete it. No mocks that will later drift.
- **Devtools are not deferred.** A working event-sourced runtime without tooling is not a working runtime. Devtools ship in the first phase that produces journaled events.
- **Every sprint ends with an integration test that exercises the full stack built to date.** No sprint is closed until a test run from the highest-level API down through the newest layer passes.

---

## 2. Phase one — primitives to first rendered app

Phase one builds every package in the framework to a first release that can render a schema-authored application with events, projections, forms, data, and shell. Ten sprints, organized into four stages.

### 2.1 Stage 1: primitives and backbone

**Sprint 1 — blu-core, blu-schema, blu-validate**

Deliverable: the primitive types, the schema types, and the runtime validator. BluEvent envelope, EventClass, Durability, Origin, Authority, Projection, PartialEvent. ApplicationConfiguration, ViewNode, DataSource, FormDefinition, Action, Condition, ComponentMeta. A runtime validator that checks envelopes, configurations, and form submissions against the schemas.

Exit criteria:
- All envelope and schema types compile under TypeScript strict mode with no `any` and no `unknown` in public signatures beyond documented locations.
- `blu-core`, `blu-schema`, and `blu-validate` are published as alpha to the internal registry.
- `blu-validate` validates a well-formed event envelope in O(1) and rejects malformed envelopes with a structured error.
- Tests: type-level tests for envelope shape, migration function signatures, projection generic parameterization; runtime tests for envelope validation, schema validation, form validation.

**Sprint 2 — blu-bus**

Deliverable: the in-process event transport. `emit`, `subscribe`, middleware chain, filter resolution, auto-filling of eventId, timestamp, sequence, causationId, and correlationId.

Exit criteria:
- `emit` returns a finalized `BluEvent` with correct envelope fields, including causal inheritance from an in-flight handler context.
- Middleware can short-circuit, annotate, and observe without mutating payload.
- Subscription filters work by type, by namespace prefix, by scope path, and by custom predicate.
- Tests: emission, middleware order, filter semantics, causal propagation, error isolation.

**Sprint 3 — blu-slate**

Deliverable: the journal, the projection engine, authority enforcement. In-memory journal first; IndexedDB persistence next. Snapshot and compaction. Replay from snapshot plus journal tail.

Exit criteria:
- Registering a projection and emitting events drives the reducer correctly, with memoized output.
- Authority is enforced: writes to `server-authoritative` projections without a fact event are rejected.
- Snapshot and compaction round-trip: a projection snapshot can be serialized, loaded, and extended with journal-tail replay to produce identical state.
- Replay dispatches with `origin: "replay"`, and subscribers can discriminate.
- Derived projections recompute when their sources change, without journal churn.
- Tests: journal ordering, projection memoization, authority rejection paths, snapshot round-trip, replay fidelity.

**Stage 1 gate:** a test harness can register projections, emit events through the bus, observe projection state, persist to IndexedDB, reload, and observe the same state. No React. No views. The backbone works on its own.

### 2.2 Stage 2: integration

**Sprint 4 — blu-wire**

Deliverable: the transport contract and two initial adapters: `LocalTransport` (for tests) and `BroadcastChannelTransport` (for cross-tab). Idempotent receive, connection lifecycle, status eventing.

Exit criteria:
- Two slates in the same process, connected by `BroadcastChannelTransport`, replicate a `replicated`-durability event in both directions with deterministic ordering.
- Duplicate event IDs at the receiving slate are deduplicated silently.
- Transport disconnection emits `sync:transport:error`; reconnection emits `sync:session:resumed`.
- Tests: cross-tab propagation, idempotency, disconnection behavior, ordering under concurrent writes.

**Sprint 5 — blu-context and the React binding**

Deliverable: `<BluProvider>`, `useEmit`, `useProjection`, `useDataSource`, `useSlate`, `useBus`, `useEventSubscription`. No view layer yet — these hooks drive any React component the application wires up manually.

Exit criteria:
- A React component mounted under `<BluProvider>` can emit, read projections, and update DOM in response to events.
- Re-renders fire only when the consumed projection changes, verified by render counters.
- A parent projection subscription does not cause child re-renders if the child reads a different projection.
- Tests: provider wiring, re-render correctness, unmount cleanup, context nesting.

**Sprint 6 — blu-devtools (MVP)**

Deliverable: devtools that visualize the journal timeline, trace causal chains, inspect projections, and monitor transports. Ships as a standalone dev panel; later sprints integrate it into browser extensions and the CLI.

Exit criteria:
- The timeline renders every observable or higher event in order.
- Clicking an event shows its causal parents up to the root and its derived children.
- The projection inspector lists every registered projection with its authority and current state.
- The transport monitor shows registered transports, their status, and throughput.
- Tests: timeline correctness, causal graph correctness on contrived chains, projection inspection after replay.

**Stage 2 gate:** a React application mounted under the provider can emit events, read projections, cross-tab sync, and inspect itself in devtools. No schema rendering yet.

### 2.3 Stage 3: view and authoring surface

**Sprint 7 — blu-view (ViewNode renderer and ComponentRegistry)**

Deliverable: the `<View>` component that interprets a ViewNode, resolves bindings, subscribes to projections, and renders. The `ComponentRegistry` for URN-addressed components.

Exit criteria:
- A ViewNode tree with static props renders identically to the equivalent JSX tree.
- A ViewNode with bindings reads from projections and re-renders on event-driven state changes.
- Conditions and repeat directives render correctly.
- Unknown URNs render a labelled fallback in dev and a silent nothing in production.
- Tests: render parity, binding resolution, condition evaluation, repeat keying, unknown-URN handling.

**Sprint 8 — schema actions, data sources, forms**

Deliverable: action resolution (`navigate`, `emit`, `form`, `composite`), data source registration and projection materialization (`RestDataSource`, `StaticDataSource`, `ProjectionDataSource`), and the form projection with field bindings and validation.

Exit criteria:
- A schema-authored button with an `emit` action produces the correct event on click.
- A `RestDataSource` produces a projection with `{ status, data, error }` that transitions correctly on fetch.
- A form with required fields blocks submission until valid; submission emits the expected fact event with the form payload.
- Tests: action compilation, data source lifecycle, form field mutation, validation, submit flow.

**Stage 3 gate:** a non-trivial application — an interactive dashboard with forms, data fetching, cross-tab sync, and devtools coverage — is authored entirely as `ApplicationConfiguration` data and runs from that data.

### 2.4 Stage 4: shell, view library, tooling

**Sprint 9 — blu-shell and the view library (blu-grid, blu-ui, blu-icons, blu-style, blu-templates, blu-blocks)**

Deliverable: the shell taxonomy per `shell.md` — the seven primaries, three presenters, four overlays. The view library with enough components (stack, row, button, text, input, card, modal content) to build representative applications. The style system with tokens, themes, and the CssBuilder.

Exit criteria:
- The `AppBar` primary renders an app with title, content, and a presenter-hosted modal that opens and dismisses via events.
- Theme change events repaint without remounting.
- A representative application composed of blu-ui components renders correctly under all seven primary shells.
- Tests: shell conformance suite, composition rules, theme round-trip.

**Sprint 10 — blu-route, blu-cli, and release hardening**

Deliverable: routing as a projection with history integration, deep link support, and cross-tab route sync. The CLI for scaffolding an application, registering components, replaying journals, and generating types. Release hardening: CHANGELOG, migration guide (none yet — it's version zero), published docs.

Exit criteria:
- Route changes emit `router:navigated` and are observed by the shell to update primary chrome.
- Back-forward navigation dispatches the correct projection state on each step.
- `blu new` scaffolds a runnable starter application.
- `blu replay` reproduces a captured session from a journal dump.
- `blu types` generates TypeScript types from a registered component set and event registry.
- End-to-end: a first-party example application ships with the release.

**Stage 4 gate:** phase one complete. The framework is usable end-to-end from the primitives to the authoring surface to the shell to tooling. A representative reference application demonstrates every feature.

---

## 3. Dependency rules during phase one

These rules govern who can import whom while phase one is in flight.

- `blu-core` imports nothing. It is the bottom.
- `blu-schema` imports `blu-core` types only.
- `blu-validate` imports `blu-core` and `blu-schema`.
- `blu-bus` imports `blu-core` and `blu-validate` (for envelope validation in middleware).
- `blu-slate` imports `blu-core`. It does not import `blu-bus` — the bus wires *into* the slate through the standard subscription API.
- `blu-wire` imports `blu-core`.
- `blu-context` imports `blu-core`, `blu-bus`, `blu-slate`, and React.
- `blu-view` imports `blu-core`, `blu-schema`, `blu-context`, and React.
- `blu-devtools` imports `blu-core`, `blu-bus`, `blu-slate`, and React. It never imports view packages.
- View library packages (`blu-ui`, `blu-grid`, `blu-icons`, `blu-style`, `blu-templates`, `blu-blocks`) import `blu-core`, `blu-schema`, `blu-context`, and React. They may import `blu-style`.
- `blu-shell` imports `blu-core`, `blu-schema`, `blu-context`, `blu-view`, `blu-grid`, and `blu-style`.
- `blu-route` imports `blu-core`, `blu-schema`, `blu-context`, `blu-slate`.
- `blu-cli` imports `blu-core`, `blu-schema`, `blu-slate`, and authoring tools. It does not import React.
- `@kitsy/blu` (the meta package) re-exports from the public API of the common set. It has no implementation.

A dependency that violates these rules is rejected in review. If a new need appears, the fix is to elevate a shared concern into `blu-core` or `blu-schema`, not to reach across layers.

---

## 4. Quality rules

These apply to every package, every sprint.

- TypeScript strict mode. `any` is not allowed; use `unknown` with type guards.
- Public functions carry JSDoc.
- Test coverage on public API is above 80 percent, measured per package.
- Zero ESLint warnings on commit.
- Every package has a CHANGELOG, even if the initial entry is "0.1.0 — initial."
- No package ships without unit tests, no stage gate passes without integration tests at the gate level.

---

## 5. What is out of scope for phase one

Listed here so nobody wonders.

- Server-side runtime. The slate persists locally to IndexedDB in phase one. A Node-side slate for SSR, prerender, or server-rendered replay is a later phase concern.
- Production transport to a remote server. `BroadcastChannelTransport` and `LocalTransport` ship in phase one. WebSocket, SSE, and HTTP transports are later.
- The Kitsy Studio visual builder. Studio consumes Blu but is a separate track.
- The Kitsy Mind AI generator. Also separate track.
- Migration tooling for event schema evolution. The hooks and contracts are in place; the CLI `blu migrate` lands in a later phase.
- A component contribution surface for third-party packages. The URN scheme supports it; the registry and publish pipeline for it come later.
- Performance benchmarks as a gating criterion. Correctness first; performance hardening is an explicit later sprint.

Anything on this list that a sprint touches incidentally should be scoped narrowly and documented; anything that would pull a sprint wider is deferred.

---

## 6. Related documents

- `docs/blu/foundation.md` — principles.
- `docs/blu/architecture.md` — layering and package map.
- `docs/blu/specification.md` — the contracts being built.
- `docs/blu/shell.md` — shell targets that sprint 9 delivers.
- `docs/governance.md` — decision authority, scope protocol.
