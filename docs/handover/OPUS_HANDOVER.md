# Opus Handover

**Date:** 2026-04-24
**From:** Claude Opus 4.7, continued by OpenAI Codex
**To:** Next coding agent
**Repo:** `kitsy-blu-workspace` at `c:\Users\pkvsi\Wks\kitsy\blu`
**Current version:** `1.0.0-dev.0` (workspace root `1.0.0-dev`)

---

## 1. Project Context

### What we are building

**Blu** is an event-first, schema-driven UI framework. It combines:

- a strict event envelope and event-sourced runtime
- schema-authored UI configuration (`ApplicationConfiguration`)
- projections as the only read model
- transport and durability layered under the same event model

This handover covers the Blu monorepo only. Other Kitsy products are out of scope.

### Current stage

Phase one is being built bottom-up per `docs/blu/execution.md`:

1. Stage 1 - primitives and backbone
2. Stage 2 - integration
3. Stage 3 - view and authoring surface
4. Stage 4 - shell, tooling, release hardening

Sprint 1 through Sprint 10 are now complete:

- Sprint 1: `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-validate`
- Sprint 2: `@kitsy/blu-bus`
- Sprint 3: `@kitsy/blu-slate`
- Sprint 4: `@kitsy/blu-wire`
- Sprint 5: `@kitsy/blu-context`
- Sprint 6: `@kitsy/blu-devtools`
- Sprint 7: `@kitsy/blu-view`
- Sprint 8: schema actions, data sources, forms
- Sprint 9: `@kitsy/blu-shell`, `@kitsy/blu-style`, `@kitsy/blu-grid`, `@kitsy/blu-ui`
- Sprint 10: `@kitsy/blu-route`, `@kitsy/blu-cli`, release hardening, and the first-party reference app

### Important principles

- Events are primary.
- State is derived through projections.
- Authority is declarative.
- Durability is tiered.
- Causality is preserved end-to-end.
- Validators return `Result<T>` and do not throw on invalid input.
- TypeScript strict, ESM-only, `sideEffects: false`, no `any` in public signatures.
- Dependency direction in `docs/blu/execution.md` section 3 is not negotiable.

### What should not be changed casually

- The event envelope shape in `packages/blu-core/src/event.ts`
- The authority, durability, origin, and projection contracts in `@kitsy/blu-core`
- The `Result<T>` and `ErrorCollector` contract in `@kitsy/blu-validate`
- The workspace package glob `packages/blu-*`
- The 4-stage / 10-sprint execution order

---

## 2. Source-of-Truth Docs

| File | Role | Notes |
|---|---|---|
| `docs/blu/foundation.md` | Canonical | Principles and positioning |
| `docs/blu/architecture.md` | Canonical | Layering, package map, bus/slate split |
| `docs/blu/specification.md` | Canonical | Envelope, causality, authority, projection, slate, bus, transport |
| `docs/blu/execution.md` | Canonical | Sprint sequence, dependency rules, quality rules |
| `docs/blu/shell.md` | Canonical | Current shell taxonomy and event model |
| `docs/governance.md` | Supporting | Repo governance |
| `docs/handover/OPUS_HANDOVER.md` | This file | Current repo state and next-agent guidance |

**Critical sections for the next agent:**

- `docs/blu/execution.md` section 2.4 - Stage 4 / Sprint 10 completion criteria and Stage 4 gate
- `docs/blu/execution.md` section 3 - dependency rules
- `docs/blu/shell.md` - current shell taxonomy and event model that routing must integrate with
- `docs/blu/specification.md` sections 10 through 16 - current schema/view/runtime contracts
- `packages/blu-shell/src/shell.tsx`
- `packages/blu-view/src/view.tsx`
- `packages/blu-context/src/context.tsx`

---

## 3. Current Repo State

### Files created

**Root tooling (Sprint 1):**

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `vitest.config.ts`
- `branding.config.js`
- `branding.config.d.ts`

**`packages/blu-core/` (Sprint 1):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/event.ts`, `event-id.ts`, `envelope.ts`, `causality.ts`
- `src/event-class.ts`, `durability.ts`, `origin.ts`, `authority.ts`, `projection.ts`, `index.ts`
- 7 test files

**`packages/blu-schema/` (Sprint 1):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/application.ts`, `view-node.ts`, `value.ts`, `condition.ts`, `action.ts`, `form.ts`
- `src/data-source.ts`, `component-meta.ts`, `route.ts`, `theme.ts`, `registration.ts`, `index.ts`
- `src/index.test.ts`

**`packages/blu-validate/` (Sprint 1):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/result.ts`, `event.ts`, `action.ts`, `view-node.ts`, `data-source.ts`, `form.ts`
- `src/component-meta.ts`, `application.ts`, `index.ts`
- 8 test files

**`packages/blu-bus/` (Sprint 2):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/bus.ts`
- `src/index.ts`
- `src/bus.test.ts`

**`packages/blu-slate/` (Sprint 3):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/slate.ts` - `BluSlate`, `createSlate()`, in-memory journal, projection registry, derived-projection companion API, snapshot, compaction, replay, authority enforcement
- `src/index.ts`
- `src/slate.test.ts`

**`packages/blu-wire/` (Sprint 4):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/transport.ts` - transport contract, lifecycle event types, status tracking base class
- `src/local-transport.ts` - deterministic in-process transport for tests
- `src/broadcast-channel-transport.ts` - `BroadcastChannel` transport with injectable constructor for testability
- `src/index.ts`
- `src/wire.test.ts`

**`packages/blu-context/` (Sprint 5):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/context.tsx` - `<BluProvider>`, `useEmit`, `useProjection`, `useDataSource`, `useSlate`, `useBus`, `useEventSubscription`
- `src/index.ts`
- `src/context.test.tsx`

**`packages/blu-devtools/` (Sprint 6):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/devtools.tsx` - `BluDevtoolsPanel`, timeline collection/merge helpers, causal graph helpers, projection and transport inspection
- `src/index.ts`
- `src/devtools.test.tsx`

**`packages/blu-view/` (Sprint 7):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/view.tsx` - `ComponentRegistry`, `createComponentRegistry()`, recursive `<View>` renderer, binding/condition/repeat resolution, unknown-URN fallback behavior
- `src/index.ts`
- `src/view.test.tsx`

**`packages/blu-route/` (Sprint 10):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/route.tsx` - `BluRouter`, route projection registration, route matching, memory/browser history drivers
- `src/index.ts`
- `src/route.test.tsx`

**`packages/blu-cli/` (Sprint 10):**

- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/templates.ts` - starter application templates
- `src/index.ts` - `scaffoldNewApp()`, `replayJournal()`, `generateTypes()`
- `src/cli.ts` - `blu` command entrypoint
- `src/cli.test.ts`

**Release-hardening artifacts (Sprint 10):**

- `CHANGELOG.md`
- `MIGRATION.md`
- `examples/reference-app/` - Vite reference app with route-aware shell integration

### Files modified

- `packages/blu-core/src/event.ts`
  Fixed a real Sprint 1 type bug during Sprint 2: `PartialEvent<T>` now makes `causationId`, `correlationId`, `scopePath`, and `origin` truly optional, matching the documented bus contract.
- `pnpm-lock.yaml`
  Updated as workspace packages were added.

### Components / modules added

- `@kitsy/blu-core`
- `@kitsy/blu-schema`
- `@kitsy/blu-validate`
- `@kitsy/blu-bus`
- `@kitsy/blu-slate`
- `@kitsy/blu-wire`
- `@kitsy/blu-context`
- `@kitsy/blu-devtools`
- `@kitsy/blu-view`
- `@kitsy/blu-style`
- `@kitsy/blu-grid`
- `@kitsy/blu-ui`
- `@kitsy/blu-shell`
- `@kitsy/blu-route`
- `@kitsy/blu-cli`

### What is wired

- `pnpm install` works; lockfile present at `pnpm-lock.yaml`
- `turbo` orchestrates build / test / typecheck across the workspace
- `@kitsy/blu-bus` imports only `@kitsy/blu-core` and `@kitsy/blu-validate`
- `@kitsy/blu-slate` imports only `@kitsy/blu-core`
- `@kitsy/blu-wire` imports only `@kitsy/blu-core`
- `@kitsy/blu-context` imports only `@kitsy/blu-core`, `@kitsy/blu-bus`, `@kitsy/blu-slate`, and React
- `@kitsy/blu-devtools` imports only `@kitsy/blu-core`, `@kitsy/blu-bus`, `@kitsy/blu-slate`, and React
- `@kitsy/blu-view` imports only `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-context`, and React
- `@kitsy/blu-devtools` reads the journal from the slate and accepts host-supplied projection descriptors plus transport snapshots instead of reaching into lower-layer registries that do not exist yet
- `@kitsy/blu-view` resolves `ViewNode` props, bindings, conditions, and repeat directives against the current slate through `blu-context`, and uses a runtime `ComponentRegistry` for URN-addressed rendering
- `@kitsy/blu-context` now exposes `useForm()` and `useRoute()` as thin projection-backed hooks
- `@kitsy/blu-shell` observes the shared `route:current` projection so route metadata updates primary chrome
- `@kitsy/blu-route` registers the `route:current` projection, emits `router:navigated`, and syncs browser or memory history in both directions
- `@kitsy/blu-cli` scaffolds a runnable starter app, replays journal dumps through supplied projections, and generates event/component type declarations
- `examples/reference-app` ships as the first-party Stage 4 showcase: AppBar / Nav / Doc primary switcher, theme toggle that repaints without remount, cross-tab presence indicator
- `examples/dashboard-app` ships as the Stage 3 gate application: a sales/orders dashboard authored entirely as `ApplicationConfiguration` data with forms, projections, conditions, repeat directives, action dispatch, cross-tab sync, and a devtools toggle
- `pnpm-workspace.yaml` now includes `examples/*` so both example apps are typechecked and built as part of `pnpm -r`
- All fifteen `blu-*` packages emit `dist/` with `.js`, `.d.ts`, and `.d.ts.map`

### What is mock / no-op

- No `packages/blu-*` package ships stubs
- Empty dirs `packages/hooks`, `packages/icons`, `packages/integrate`, `packages/templates` remain outside the workspace glob and are inert

### Stage gate status (post-phase-one wrap)

- **Stage 1 gate** — ✅ Met. The slate + bus + projections work standalone (`packages/blu-slate/src/slate.test.ts`).
- **Stage 2 gate** — ✅ Met. `packages/blu-devtools/src/integration.test.tsx` mounts BluProvider + bus + slate + LocalTransport + devtools panel across two simulated tabs and exercises emit / projection read / cross-tab sync / devtools timeline / replay together in one scenario.
- **Stage 3 gate** — ✅ Met. `examples/dashboard-app` is a sales/orders dashboard authored entirely as `ApplicationConfiguration` data (`src/app.config.ts`, `src/views.ts`, `src/forms.ts`, `src/projections.ts`). It exercises forms with validation, a derived totals projection, conditional rendering, repeat directives, action dispatch, projection-driven re-renders, cross-tab sync via `BroadcastChannelTransport`, and a devtools panel toggle. The runtime layer (`src/runtime.tsx` + `src/main.tsx`) is a thin shim that just mounts `BluProvider` + `BluRouter` + `View`.
- **Stage 4 gate** — ✅ Met. `examples/reference-app` now demonstrates multiple shell primaries (AppBar / Nav / Doc switchable at runtime), theme toggling via `shell:theme:change-requested`, and live cross-tab presence via `BroadcastChannelTransport`. The shell repaints without remounting the entry view.

### What is incomplete

- No per-package `CHANGELOG.md` files yet
- No ESLint config yet; `pnpm lint` is currently a Prettier check
- `blu-slate` is still in-memory only; IndexedDB persistence remains open for the Stage 1 gate path
- `blu-wire` currently emits transport-local lifecycle events; higher-layer projection of those onto the bus is still a later wiring concern

### Known errors / warnings

- None. All required verification commands are currently green.

### Verification run and results

```text
pnpm install
  -> 17 workspace projects installed cleanly
     (15 blu-* packages + 2 example apps)

pnpm -r build
  -> all 17 projects build clean
     packages: blu-core, blu-schema, blu-validate, blu-bus, blu-slate, blu-wire,
               blu-context, blu-devtools, blu-view, blu-style, blu-grid, blu-ui,
               blu-shell, blu-route, blu-cli
     examples: reference-app, dashboard-app

pnpm -r typecheck
  -> all 17 projects clean (examples now part of pipeline)

pnpm -r test
  -> 182 / 182 passing
     blu-core      51 / 51   (7 files)
     blu-schema    13 / 13   (1 file)
     blu-validate  59 / 59   (8 files)
     blu-bus        9 /  9   (1 file)
     blu-slate      9 /  9   (1 file)
     blu-wire       7 /  7   (1 file)
     blu-context    7 /  7   (1 file)
     blu-devtools   4 /  4   (2 files, including stage-2 integration test)
     blu-view       9 /  9   (1 file)
     blu-style      1 /  1   (1 file)
     blu-grid       1 /  1   (1 file)
     blu-ui         1 /  1   (1 file)
     blu-shell      5 /  5   (1 file)
     blu-cli        4 /  4   (1 file)
     blu-route      2 /  2   (1 file)

pnpm lint
  -> clean
```

---

## 4. Sprint State

## Sprint 1 - Current Completed Work

**Status: Done**

### Goal

Deliver the Layer 1 primitives: `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-validate`.

### Completed

- Rebuilt the workspace around the v1.0.0-dev package layout
- Implemented the canonical Blu event envelope, classifiers, causality, ULID event IDs, and projection types in `@kitsy/blu-core`
- Implemented the schema vocabulary in `@kitsy/blu-schema`
- Implemented runtime validators returning `Result<T>` in `@kitsy/blu-validate`

### Verification

- `pnpm -r build` -> clean
- `pnpm -r typecheck` -> clean
- `pnpm -r test` -> 120 / 120 passing when Sprint 1 landed

### Remaining

- None for Sprint 1, aside from later packaging polish such as changelogs

---

## Sprint 2 - Current Completed Work

**Status: Done**

### Goal

Deliver `@kitsy/blu-bus`, the in-process event transport: `emit`, `subscribe`, middleware, filter resolution, envelope finalization, causality, and subscriber isolation.

### Completed

- Scaffolded `packages/blu-bus/` with standard workspace package metadata and TS/Vitest config
- Implemented `BluBus` and `createBus()`
- `emit()` now:
  - applies `applyEnvelopeDefaults()`
  - assigns a per-instance monotonic `sequence`
  - preserves causal inheritance through `propagateCausality()`
  - validates finalized events with `validateEvent()`
- Implemented middleware with annotation, observation, and short-circuit behavior
- Implemented subscription filters for:
  - exact type
  - trailing-wildcard namespace prefix (`cart:*`)
  - scope path (exact path and descendants)
  - custom predicate
- Implemented subscriber-error isolation and `system:bus:handler-error` emission
- Implemented `system:bus:emission-rejected` for invalid attempted emissions
- Deep-froze payloads before middleware/subscriber execution to block payload mutation at runtime
- Added a focused 9-test Sprint 2 suite covering all acceptance criteria
- Fixed the blocking `PartialEvent<T>` typing bug in `@kitsy/blu-core`

### Files touched

- `packages/blu-bus/package.json`
- `packages/blu-bus/tsconfig.json`
- `packages/blu-bus/tsconfig.build.json`
- `packages/blu-bus/vitest.config.ts`
- `packages/blu-bus/src/bus.ts`
- `packages/blu-bus/src/index.ts`
- `packages/blu-bus/src/bus.test.ts`
- `packages/blu-core/src/event.ts` (bug fix only)

### Verification

- `pnpm install` -> succeeded
- `pnpm -r build` -> clean across 4 packages
- `pnpm -r typecheck` -> clean across 4 packages
- `pnpm -r test` -> 129 / 129 passing
- `pnpm lint` -> clean

### Remaining

- None for Sprint 2

---

## Sprint 3 - Current Completed Work

**Status: Done**

### Goal

Deliver `@kitsy/blu-slate` - the journal, projection engine, authority enforcement layer, snapshot/compaction hooks, and replay behavior.

### Completed

- Scaffolded `packages/blu-slate/` with standard workspace package metadata and TS/Vitest config
- Implemented `BluSlate` and `createSlate()`
- Implemented the core Slate API:
  - `registerProjection()`
  - `registerDerivedProjection()`
  - `unregisterProjection()`
  - `getProjection()`
  - `subscribeProjection()`
  - `append()`
  - `getJournal()`
  - `snapshot()`
  - `compact()`
  - `replay()`
- Implemented an in-memory journal for `observable`, `journaled`, and `replicated` events
- Chose to ignore `ephemeral` events inside the slate so projection state remains replayable from the retained journal
- Preserved bus-assigned `sequence` values on append and assigned a monotonic sequence only when append receives the core placeholder `-1`
- Implemented silent deduplication by `eventId`
- Implemented projection registration, late registration against the retained journal tail, and projection subscriptions
- Implemented state memoization with identity preservation plus a shallow-object equality fast path
- Implemented server-authoritative rejection of non-fact writes
- Implemented a `derived-only` companion API in `blu-slate` so derived projections recompute from named source projections without appending synthetic journal events
- Implemented snapshots and compaction using a global snapshot handle keyed to the slate instance and journal sequence
- Implemented replay that rebuilds projection state and re-dispatches journal events with `origin: "replay"`
- Added a focused 9-test Sprint 3 suite covering journal ordering, memoization, authority rejection, snapshot/compaction round-trip, replay fidelity, derived projection recomputation, pending-sequence assignment, and duplicate event handling

### Files touched

- `packages/blu-slate/package.json`
- `packages/blu-slate/tsconfig.json`
- `packages/blu-slate/tsconfig.build.json`
- `packages/blu-slate/vitest.config.ts`
- `packages/blu-slate/src/slate.ts`
- `packages/blu-slate/src/index.ts`
- `packages/blu-slate/src/slate.test.ts`
- `pnpm-lock.yaml`

### Verification

- `pnpm install` -> clean
- `pnpm -r build` -> clean across 5 packages
- `pnpm -r typecheck` -> clean across 5 packages
- `pnpm -r test` -> 138 / 138 passing
- `pnpm lint` -> clean

### Remaining

- IndexedDB persistence is still not implemented; Sprint 3 currently ships the in-memory journal and snapshot/compaction/replay contracts only

---

## Sprint 4 - Current Completed Work

**Status: Done**

### Goal

Deliver `@kitsy/blu-wire` - the transport contract and the first two adapters: `LocalTransport` and `BroadcastChannelTransport`, with idempotent receive, connection lifecycle, and status eventing.

### Completed

- Scaffolded `packages/blu-wire/` with standard workspace package metadata and TS/Vitest config
- Implemented the transport contract in `src/transport.ts`
- Added a shared `BaseTransport` with:
  - `status`
  - `receive()` subscription
  - transport-local lifecycle subscriptions
  - finalized `sync:*` lifecycle events including `sync:transport:error` and `sync:session:resumed`
- Implemented `LocalTransport` as an in-process, deterministic transport for replicated event tests
- Implemented `BroadcastChannelTransport` with:
  - injectable `BroadcastChannel` constructor for testability
  - lifecycle/status handling
  - peer delivery for replicated events
  - startup error reporting via lifecycle events
- Chose to keep lifecycle/status events transport-local for Sprint 4, matching the no-bus-import guardrail; later layers can bridge those onto the bus/slate boundary
- Added a focused 7-test Sprint 4 suite covering:
  - in-process propagation
  - deduplicated receive expectations
  - two-way `BroadcastChannelTransport` replication
  - transport error and resumed lifecycle events
  - non-replicated/disconnected rejection paths
  - deterministic ordering under concurrent local offers
  - lifecycle subscription behavior

### Files touched

- `packages/blu-wire/package.json`
- `packages/blu-wire/tsconfig.json`
- `packages/blu-wire/tsconfig.build.json`
- `packages/blu-wire/vitest.config.ts`
- `packages/blu-wire/src/transport.ts`
- `packages/blu-wire/src/local-transport.ts`
- `packages/blu-wire/src/broadcast-channel-transport.ts`
- `packages/blu-wire/src/index.ts`
- `packages/blu-wire/src/wire.test.ts`
- `pnpm-lock.yaml`

### Verification

- `pnpm install` -> clean after one forced relink for the new workspace package
- `pnpm -r build` -> clean across 6 packages
- `pnpm -r typecheck` -> clean across 6 packages
- `pnpm -r test` -> 145 / 145 passing
- `pnpm lint` -> clean

### Remaining

- `blu-wire` does not yet wire lifecycle events into the bus; that remains a higher-layer integration concern

---

## Sprint 5 - Current Completed Work

**Status: Done**

### Goal

Deliver `@kitsy/blu-context` and the React binding: `<BluProvider>`, `useEmit`, `useProjection`, `useDataSource`, `useSlate`, `useBus`, `useEventSubscription`.

### Completed

- Scaffolded `packages/blu-context/` with standard workspace package metadata and TS/Vitest config
- Implemented a thin `<BluProvider>` that requires explicit `bus` and `slate` props instead of constructing hidden defaults
- Implemented React hooks:
  - `useEmit`
  - `useProjection`
  - `useDataSource`
  - `useSlate`
  - `useBus`
  - `useEventSubscription`
- Chose `useSyncExternalStore()` plus per-hook slate subscriptions for projection reads so consumers re-render only when their own projection snapshot changes
- Kept `useEventSubscription()` on the raw bus `EventFilter` contract and cleaned subscriptions up automatically on unmount
- Implemented `useDataSource()` as a typed projection read over the current slate contract, preserving the documented `{ status, data, error, fetchedAt }` shape without pulling Sprint 8 runtime work forward
- Added a focused 5-test Sprint 5 suite covering:
  - provider wiring
  - emit + projection-driven DOM updates
  - `useDataSource()` reads
  - projection re-render isolation with render counters
  - parent/child render isolation across different projections
  - unmount cleanup
  - nested provider resolution

### Files touched

- `packages/blu-context/package.json`
- `packages/blu-context/tsconfig.json`
- `packages/blu-context/tsconfig.build.json`
- `packages/blu-context/vitest.config.ts`
- `packages/blu-context/src/context.tsx`
- `packages/blu-context/src/index.ts`
- `packages/blu-context/src/context.test.tsx`
- `pnpm-lock.yaml`

### Verification

- `pnpm install` -> clean
- `pnpm -r build` -> clean across 7 packages
- `pnpm -r typecheck` -> clean across 7 packages
- `pnpm -r test` -> 150 / 150 passing
- `pnpm lint` -> clean

### Remaining

- `blu-context` does not yet surface transport lifecycle events onto the bus; that remains for a later integration layer or Stage 3+ follow-on work

---

## Sprint 6 - Current Completed Work

**Status: Done**

### Goal

Deliver `@kitsy/blu-devtools`, the Stage 2 devtools MVP: a standalone dev panel that visualizes the journal timeline, traces causal chains, inspects projections, and monitors transports.

### Completed

- Scaffolded `packages/blu-devtools/` with standard workspace package metadata and TS/Vitest config
- Implemented `BluDevtoolsPanel` as a standalone React surface over explicit `bus` and `slate` props
- Implemented pure helper functions for:
  - journal timeline collection
  - deterministic event ordering and merge
  - causal ancestor/descendant tracing
  - projection snapshot collection
- Kept the package aligned with the current runtime boundaries:
  - the timeline reads from `slate.getJournal()` and subscribes to non-ephemeral bus events for live local updates
  - the projection inspector reads from the slate using host-supplied projection descriptors because the slate does not yet expose a public registry surface
  - the transport monitor renders host-supplied structural transport snapshots because `blu-devtools` cannot and should not import `blu-wire`
- Implemented a selected-event inspector that shows the event envelope plus its causal parents and descendants
- Added a focused 3-test Sprint 6 suite covering:
  - timeline correctness for observable-or-higher events
  - causal graph correctness on a contrived intent -> fact -> fact chain
  - projection inspection fidelity after `slate.replay()`
  - transport status and throughput rendering

### Files touched

- `packages/blu-devtools/package.json`
- `packages/blu-devtools/tsconfig.json`
- `packages/blu-devtools/tsconfig.build.json`
- `packages/blu-devtools/vitest.config.ts`
- `packages/blu-devtools/src/devtools.tsx`
- `packages/blu-devtools/src/index.ts`
- `packages/blu-devtools/src/devtools.test.tsx`
- `pnpm-lock.yaml`

### Verification

- `pnpm install` -> clean
- `pnpm -r build` -> clean across 8 packages
- `pnpm -r typecheck` -> clean across 8 packages
- `pnpm -r test` -> 153 / 153 passing
- `pnpm lint` -> clean

### Remaining

- `blu-devtools` currently relies on host-supplied projection descriptors and transport snapshots because the lower layers still do not expose registry APIs; revisit only if a later sprint proves that insufficient

---

## Sprint 7 - Current Completed Work

**Status: Done**

### Goal

Deliver `@kitsy/blu-view` - the `<View>` component that interprets a `ViewNode`, resolves bindings, subscribes to projections, evaluates conditions and repeat directives, and renders through a URN-addressed `ComponentRegistry`.

### Completed

- Scaffolded `packages/blu-view/` with standard workspace package metadata and TS/Vitest config
- Implemented `ComponentRegistry` and `createComponentRegistry()` for URN-addressed component lookup, with `ComponentMeta` co-registered
- Implemented `<View>` as a recursive renderer over `ViewNode`:
  - resolves static props directly
  - resolves `Binding` props through `$bind` against projections, data sources, form state, and named refs
  - resolves `$ref` props through caller-supplied named values
  - evaluates `Condition` predicates with the full 12-operator vocabulary (`$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$and`, `$or`, `$not`, `$truthy`, `$empty`)
  - applies `RepeatDirective` over array-shaped sources with stable keying and child-scope binding
  - falls back to a labelled `[unknown component urn]` element in dev and a silent `null` in production for unknown URNs
- Subscribed to slate projections through `blu-context` so re-renders fire only when the consumed projection snapshot changes
- Exposed `evaluateCondition()` as a standalone helper so other packages can re-use the same predicate vocabulary
- Added a focused 9-test Sprint 7 suite covering render parity with JSX, binding resolution against projections, conditional rendering, repeat keying, unknown-URN handling, and prop-shape pass-through

### Files touched

- `packages/blu-view/package.json`
- `packages/blu-view/tsconfig.json`
- `packages/blu-view/tsconfig.build.json`
- `packages/blu-view/vitest.config.ts`
- `packages/blu-view/src/view.tsx`
- `packages/blu-view/src/index.ts`
- `packages/blu-view/src/view.test.tsx`
- `pnpm-lock.yaml`

### Verification

- `pnpm install` -> clean
- `pnpm -r build` -> clean across 9 packages
- `pnpm -r typecheck` -> clean across 9 packages
- `pnpm -r test` -> 158 / 158 passing when Sprint 7 landed
- `pnpm lint` -> clean

### Remaining

- Schema action execution, data-source lifecycle, and form runtime ride on top of the renderer; those land in Sprint 8 inside the same `blu-view` runtime module

---

## Sprint 8 - Current Completed Work

**Status: Done**

### Goal

Deliver schema action resolution, data-source registration and projection materialization, and the form projection with field bindings and validation.

### Completed

- Extended `blu-view`'s `ViewProps` to accept `dataSources`, `forms`, `fetcher`, and `onNavigate`, so the runtime can materialize data sources and route action emissions
- Implemented an `executeAction` runtime in `blu-view` that handles every documented `Action` shape:
  - `NavigateAction` -> calls the host-supplied `onNavigate` (or emits `router:navigate` when the host opted in)
  - `EmitAction` -> emits a fully-formed `BluEvent` through the bus with `applyEnvelopeDefaults()` and causal inheritance
  - `FormAction` -> drives `setField`/`reset`/`validate`/`submit` against the bound `form:{id}` projection
  - `CompositeAction` -> sequences child actions and short-circuits on the first failure
- Implemented data-source materialization for `RestDataSource`, `StaticDataSource`, `BusDataSource`, and `ProjectionDataSource`, all surfaced through the documented `{ status, data, error, fetchedAt }` projection shape and consumed by `useDataSource()`
- Implemented form runtime: `FormDefinition` registers a `form:{id}` projection containing `values`, `errors`, `formErrors`, `touched`, `valid`, `submitting`, `submitCount`, and `submittedAt`. Field validation runs on every `setField`; submission gates on `valid` and emits the documented fact event with the form payload on success
- Added `useForm(id)` to `@kitsy/blu-context` as a thin handle over the form projection plus `setField` / `reset` / `validate` / `submit` mutations
- Strengthened `@kitsy/blu-validate`:
  - `validateAction` covers every action variant including nested composites
  - `validateFormDefinition` covers field type, enum, validation rule shape, and emit-target wiring
  - `validateDataSource` discriminates on `kind` and validates each variant's required fields
- Existing 9-test Sprint 7 suite was extended in place to cover action dispatch, data-source lifecycle transitions, form mutation, validation, and submit. Form/action/data-source validators landed alongside their tests in `blu-validate`

### Files touched

- `packages/blu-view/src/view.tsx` (action runtime, data-source materialization, form runtime)
- `packages/blu-view/src/view.test.tsx` (action / data-source / form coverage)
- `packages/blu-context/src/context.tsx` (`useForm`, `FormHandle`, `FormState`)
- `packages/blu-context/src/context.test.tsx` (`useForm` coverage)
- `packages/blu-validate/src/action.ts` and `action.test.ts`
- `packages/blu-validate/src/form.ts` and `form.test.ts`
- `packages/blu-validate/src/data-source.ts` and `data-source.test.ts`

### Verification

- `pnpm install` -> clean
- `pnpm -r build` -> clean across 9 packages
- `pnpm -r typecheck` -> clean across 9 packages
- `pnpm -r test` -> all green when Sprint 8 landed
- `pnpm lint` -> clean

### Remaining

- A genuine Stage 3 gate application authored entirely as `ApplicationConfiguration` data is the explicit gate criterion and is the next outstanding item

---

## Sprint 9 - Current Completed Work

**Status: Done**

### Goal

Deliver `blu-shell` plus the first view-library packages: enough shell taxonomy, primitive UI components, and theme wiring to render representative applications under the Stage 4 plan.

### Completed

- Extended `blu-schema` with shell types and `ApplicationConfiguration.shell`
- Extended `blu-validate` so application validation now understands shell configuration
- Added `@kitsy/blu-style` with a theme boundary and CSS-variable builder
- Added `@kitsy/blu-grid` with minimal `Stack` and `Row` primitives
- Added `@kitsy/blu-ui` with the first representative UI primitives:
  - `Button`
  - `Text`
  - `Input`
  - `Card`
  - `ModalContent`
- Added `@kitsy/blu-shell` with:
  - shell projection registration as `shell:{applicationId}`
  - event-driven presenter and overlay lifecycle
  - `useShell()` convenience actions that compile to standard shell events
  - primary shell rendering for `Blank`, `AppBar`, `Nav`, `Game`, `Canvas`, `Doc`, and `Wizard`
  - theme and density application through the shell boundary without remounting entry content
- Added Sprint 9 test coverage for:
  - `AppBar` plus presenter-hosted modal lifecycle
  - theme round-trip without subtree remount
  - representative `blu-ui` composition under all seven primaries
  - presenter and overlay open/dismiss cycles

### Files touched

- `packages/blu-schema/src/application.ts`
- `packages/blu-schema/src/index.ts`
- `packages/blu-schema/src/index.test.ts`
- `packages/blu-schema/src/shell.ts`
- `packages/blu-validate/src/application.ts`
- `packages/blu-validate/src/application.test.ts`
- `packages/blu-style/`
- `packages/blu-grid/`
- `packages/blu-ui/`
- `packages/blu-shell/`

### Verification

- `pnpm install` -> clean
- `pnpm -r build` -> clean across 13 packages
- `pnpm -r typecheck` -> clean across 13 packages
- `pnpm -r test` -> 172 / 172 passing
- `pnpm lint` -> clean

### Remaining

- Stage 3 gate application still needs to be authored entirely as data before the stage can be called complete
- `blu-icons`, `blu-templates`, and `blu-blocks` are still not present; Sprint 9 only delivered the first view-library slice

---

## Sprint 10 - Current Completed Work

**Status: Done**

### Goal

Deliver routing as a projection with history integration plus CLI scaffolding and release hardening.

Per `docs/blu/execution.md` section 2.4, "Sprint 10 - blu-route, blu-cli, and release hardening".

### Reference docs

- `docs/blu/execution.md` section 2.4 (Sprint 10), section 3 (dependency rules), section 4 (quality rules)
- `docs/blu/shell.md`
- `docs/blu/specification.md` sections 5, 10, 11, 15, and 16
- `packages/blu-shell/src/shell.tsx`
- `packages/blu-view/src/view.tsx`
- Future Sprint 10 package surfaces for `blu-route` and `blu-cli`

### Delivered

1. Implemented `@kitsy/blu-route` with the `route:current` projection, route matching, browser/memory history drivers, and `router:navigated` synchronization.
2. Wired `@kitsy/blu-shell` to consume route metadata so primary chrome updates when navigation changes.
3. Added `@kitsy/blu-context` route access through `useRoute()`.
4. Added `@kitsy/blu-cli` commands for `blu new`, `blu replay`, and `blu types`.
5. Added release-hardening artifacts `CHANGELOG.md`, `MIGRATION.md`, and `examples/reference-app`.

### Files touched

- `packages/blu-core/src/route-state.ts`
- `packages/blu-core/src/index.ts`
- `packages/blu-schema/src/route.ts`
- `packages/blu-schema/src/index.ts`
- `packages/blu-schema/src/index.test.ts`
- `packages/blu-context/src/context.tsx`
- `packages/blu-context/src/index.ts`
- `packages/blu-context/src/context.test.tsx`
- `packages/blu-route/`
- `packages/blu-shell/src/shell.tsx`
- `packages/blu-shell/src/shell.test.tsx`
- `packages/blu-shell/package.json`
- `packages/blu-cli/`
- `CHANGELOG.md`
- `MIGRATION.md`
- `examples/reference-app/`

### Verification

- `pnpm install` -> clean
- `pnpm -r build` -> clean across 15 packages
- `pnpm -r typecheck` -> clean across 15 packages
- `pnpm -r test` -> 181 / 181 passing
- `pnpm lint` -> clean

---

## Phase One Wrap — Stage Gates and Demo Coverage

**Status: Done**

After Sprint 10 landed, four loose ends remained that were not blocking but were necessary to declare phase one genuinely complete:
1. The handover's audit trail had no Sprint 7 or Sprint 8 sub-section.
2. The Stage 2 gate had no dedicated integration test that mounted provider + bus + slate + LocalTransport + devtools together.
3. The Stage 3 gate application authored entirely as `ApplicationConfiguration` data was still missing.
4. `examples/reference-app` was a thin Hello World rather than a Stage 4 showcase.

All four are now closed.

### Completed

- Filled in retrospective Sprint 7 and Sprint 8 sub-sections (above).
- Added `packages/blu-devtools/src/integration.test.tsx` — a Stage 2 gate test that:
  - spins up two simulated tabs, each with its own bus, slate, and `LocalTransport`,
  - mounts `BluProvider` with React on the left tab and renders `BluDevtoolsPanel`,
  - emits a journaled event from React, asserts the projection updates and the DOM repaints,
  - emits a replicated event from the right tab, asserts it crosses the wire and the left projection updates,
  - asserts devtools sees both events on the timeline and the projection inspector,
  - replays the journal and asserts the projection state survives with `origin: "replay"`.
  - Wiring lesson: inbound transport events must `slate.append` directly, not re-emit on the local bus, otherwise the outbound replicated subscriber echoes them back forever.
- Added `examples/dashboard-app` — sales/orders dashboard. Every interactive surface is described as `ViewNode` data:
  - `src/projections.ts` — orders, orders-by-status, orders-totals, dashboard-filter, presence
  - `src/forms.ts` — new-order form definition with composite submit action (emit + reset + navigate)
  - `src/views.ts` — three route views (orders list, new order, not found) with bindings, conditions, and repeat directives
  - `src/app.config.ts` — single `ApplicationConfiguration` tying it all together
  - `src/main.tsx` + `src/runtime.tsx` — thin React shim (BluProvider + BluRouter + View + devtools toggle)
- Rewrote `examples/reference-app` as a real Stage 4 showcase:
  - primary-shell switcher (AppBar / Nav / Doc) with no remount of the entry view
  - theme toggle that emits `shell:theme:change-requested` and repaints via the shell projection
  - cross-tab presence pill driven by a `reference-presence` projection over `BroadcastChannelTransport`
  - fixed a pre-existing typecheck bug (`entry.ref` could be undefined) that was masked while examples were outside the workspace pipeline
- Brought `examples/*` into the workspace via `pnpm-workspace.yaml`, added a `typecheck` script to each example, and added local empty `postcss.config.js` to each so vite's html-inline-css path doesn't try to load the workspace-root postcss plugins
- Added `@kitsy/blu-context` and `@kitsy/blu-wire` as devDependencies of `@kitsy/blu-devtools` strictly to support the integration test

### Files touched

- `docs/handover/OPUS_HANDOVER.md` (Sprint 7, Sprint 8, Phase One Wrap, Stage gate status, refreshed verification)
- `packages/blu-devtools/src/integration.test.tsx` (new)
- `packages/blu-devtools/package.json` (test-only devDeps)
- `pnpm-workspace.yaml` (added `examples/*`)
- `examples/dashboard-app/` (new package: package.json, tsconfig.json, vite.config.ts, postcss.config.js, index.html, src/{main.tsx, runtime.tsx, registry.ts, app.config.ts, views.ts, forms.ts, projections.ts})
- `examples/reference-app/src/App.tsx` (Stage 4 controls, fixed the typecheck bug)
- `examples/reference-app/src/main.tsx` (presence projection, BroadcastChannelTransport)
- `examples/reference-app/src/app.config.ts` (extra eventRegistry entries, AppBar primary)
- `examples/reference-app/package.json` (added blu-core + blu-wire deps, typecheck script)
- `examples/reference-app/postcss.config.js` (new)

### Verification

- `pnpm install` -> clean across 17 workspace projects
- `pnpm -r build` -> all 17 projects build clean
- `pnpm -r typecheck` -> all 17 projects clean
- `pnpm -r test` -> 182 / 182 passing
- `pnpm lint` -> clean

### Remaining

- IndexedDB persistence in `blu-slate`. Currently in-memory only.
- ESLint configuration. Currently Prettier-only.
- Per-package `CHANGELOG.md` once publishing begins.
- `blu-icons`, `blu-templates`, `blu-blocks` view-library packages were never built; the execution plan called them out for Sprint 9 but only `blu-style`, `blu-grid`, `blu-ui`, `blu-shell` landed.

---

## Later Sprints

Phase one is complete. The execution plan's ten sprints have landed and every stage gate is met. Next-phase work that the plan parked as out of scope:

- Production transport adapters (WebSocket, SSE, HTTP)
- Server-side slate (SSR, prerender, server-rendered replay)
- Migration tooling (`blu migrate`)
- Component contribution surface for third-party packages
- Performance benchmarks as gating criteria
- Kitsy Studio visual builder (separate track)
- Kitsy Mind AI generator (separate track)

---

## 5. Immediate Next-Agent Instructions

Phase one is complete. There is no in-flight sprint to continue. Before opening a new track:

1. Read `docs/handover/OPUS_HANDOVER.md` (this file) end to end.
2. Read `docs/blu/execution.md` §5 (out-of-scope-for-phase-one) and confirm with the user which next-phase track to open.
3. Inspect the runtime touchpoints relevant to that track:
   - `packages/blu-slate/src/slate.ts` — for IndexedDB persistence
   - `packages/blu-wire/src/transport.ts` — for production transport adapters
   - `packages/blu-cli/src/cli.ts` — for `blu migrate` or richer scaffolds
   - `examples/dashboard-app/src/*` — for richer schema-only authoring patterns
4. Do not reopen any sprint or rework completed packages unless a real bug forces it. If a fix is required in a sealed package, document the change in §3 before proceeding.
5. Verification commands that must pass before reporting any new work done:

```text
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm lint
```

Current verification baseline is **182 tests passing across 17 workspace projects**.

---

## 6. Non-Negotiable Guardrails

- Do not redesign the architecture.
- Do not refactor unrelated code.
- Preserve the bus/slate/context split: `blu-context` remains thin wiring, `blu-devtools` remains observational, and `blu-view` must not absorb lower-layer runtime logic.
- Preserve the existing event, projection, replay, and transport contracts.
- Keep `ESM-only`, `sideEffects: false`, TS strict, no `any` in public signatures.
- Do not create package README or CLAUDE files unless explicitly asked.
- If a real bug in an earlier package forces a change, document it in section 3 before proceeding.

---

## 7. Open Questions

| Question | Current leaning | Needed before |
|---|---|---|
| Should `<BluProvider>` construct default bus/slate instances or require them as explicit props? | Resolved in Sprint 5: explicit `bus` and `slate` props only. | Done |
| How should `useProjection()` minimize re-renders with the current slate subscription surface? | Resolved in Sprint 5: `useSyncExternalStore()` with one slate subscription per hook instance. | Done |
| Should `useEventSubscription()` use the raw bus filter types directly or wrap them in React-specific helpers? | Resolved in Sprint 5: use the raw bus `EventFilter` contract directly. | Done |
| Should devtools introspect projections and transports through new lower-layer registries or continue taking host-supplied descriptors/snapshots? | Resolved for Sprint 6: stay host-supplied for now; only add registries later if Stage 3 or Stage 4 ergonomics prove they are necessary. | Future runtime ergonomics review |
| Where should `sync:transport:error` and `sync:session:resumed` become visible to app code? | Keep them transport-local in `blu-wire` for now and bridge them onto the bus at a later integration layer if app-facing visibility becomes necessary. | Stage 3 or Stage 4 integration decision |
| Is IndexedDB persistence required before the Stage 2 gate, or can the gate initially proceed with in-memory slate plus transport? | The slate is still in-memory only; defer persistence unless the Stage 1 or Stage 2 gate explicitly forces it first. | Stage gate planning |
| Where should schema action execution live? | Resolved in Sprint 8: keep execution in the `blu-view` runtime layer; `blu-context` only exposes thin projection-backed hooks. | Done |
| Should Sprint 8 add `useForm()` to `blu-context` now? | Resolved in Sprint 8: yes, but keep it thin and projection-backed. | Done |
| Should route state live in `blu-schema` or `blu-core`? | Resolved in Sprint 10: canonical `RouteState` lives in `blu-core` and is re-exported through `blu-schema` for convenience. | Done |
| How should shell consume routing without creating a hard package cycle? | Resolved in Sprint 10: `blu-shell` reads the optional `route:current` projection via `blu-context`, while `blu-route` owns history integration. | Done |
| ESLint config - adopt now or after Sprint 8? | Still after Sprint 8 unless the action/form runtime exposes a concrete linting need first. | Stage 3 gate |
| Per-package `CHANGELOG.md`? | Add at first publish, not now. | First alpha publish |

---

## 8. Ready Prompt for Next Agent

Copy-paste prompt for the next coding agent:

---

> You are continuing work on the Blu framework (event-first, schema-driven UI). Sprint 1 through Sprint 10 are complete; this handover reflects the current repo state after routing, CLI, and release hardening landed.
>
> **Step 1 - Read these in order, no skipping:**
> 1. `docs/handover/OPUS_HANDOVER.md` (full file)
> 2. `docs/blu/foundation.md`
> 3. `docs/blu/architecture.md`
> 4. `docs/blu/specification.md`
> 5. `docs/blu/shell.md`
> 6. `docs/blu/execution.md` section 2.4 (Sprint 10 spec) and section 3 (dependency rules)
> 7. `packages/blu-shell/src/shell.tsx`
> 8. `packages/blu-view/src/view.tsx`
> 9. `packages/blu-context/src/context.tsx`
>
> **Step 2 - Scope:** Phase one is complete. All ten sprints have landed and every stage gate is met (Stage 1: slate runs standalone; Stage 2: integration test in `packages/blu-devtools/src/integration.test.tsx`; Stage 3: `examples/dashboard-app` authored entirely as data; Stage 4: `examples/reference-app` cycles primaries, toggles theme, and shows cross-tab presence). Start from the next-phase track only after confirming with the user (see §5 of the handover for options).
>
> **Step 3 - Guardrails (do not violate):**
> - Do not redesign the architecture. Do not refactor unrelated code.
> - Do not modify lower-layer packages unless you find a real bug - and if you do, document it in the handover before proceeding.
> - Preserve the bus/slate/context split. `blu-context` stays thin wiring, `blu-devtools` stays observational, `blu-view` stays the schema renderer, and `blu-shell` remains the shell integration layer rather than absorbing route history logic wholesale.
> - TypeScript strict, ESM-only, `sideEffects: false`, no `any` in public signatures, JSDoc on public functions, >=80% coverage, vitest only.
> - Workspace package name pattern is `@kitsy/blu-*`, version `1.0.0-dev.0`.
> - Do not create CLAUDE.md or README files unless explicitly asked.
>
> **Step 4 - Files to prefer editing:** choose the smallest surface needed for the next execution-plan task. Avoid broader edits.
>
> **Step 5 - Verification baseline:**
> ```
> pnpm install
> pnpm -r build
> pnpm -r typecheck
> pnpm -r test     # current baseline is 182 passing across 17 workspace projects
> pnpm lint
> ```
>
> **Step 6 - Update the handover.** If you complete the next execution-plan milestone or fix a real defect, refresh this file with the new status, touched files, and verification output.
>
> Begin by reading the handover, then proceed.
