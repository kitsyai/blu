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

Sprint 1 through Sprint 4 are now complete:

- Sprint 1: `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-validate`
- Sprint 2: `@kitsy/blu-bus`
- Sprint 3: `@kitsy/blu-slate`
- Sprint 4: `@kitsy/blu-wire`

Sprint 5 (`@kitsy/blu-context`) is next.

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
| `docs/blu/shell.md` | Canonical | Needed later in Sprint 9 |
| `docs/governance.md` | Supporting | Repo governance |
| `docs/handover/OPUS_HANDOVER.md` | This file | Current repo state and next-agent guidance |

**Critical sections for the next agent:**

- `docs/blu/execution.md` section 2.1 - Sprint 5 (`blu-context`) spec and exit criteria
- `docs/blu/execution.md` section 3 - dependency rules
- `docs/blu/specification.md` sections 7, 8, 9, and 16 - slate API, bus API, transport contract, React hooks
- `packages/blu-bus/src/bus.ts`
- `packages/blu-slate/src/slate.ts`
- `packages/blu-wire/src/transport.ts`

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

### What is wired

- `pnpm install` works; lockfile present at `pnpm-lock.yaml`
- `turbo` orchestrates build / test / typecheck across the workspace
- `@kitsy/blu-bus` imports only `@kitsy/blu-core` and `@kitsy/blu-validate`
- `@kitsy/blu-slate` imports only `@kitsy/blu-core`
- `@kitsy/blu-wire` imports only `@kitsy/blu-core`
- All six workspace packages emit `dist/` with `.js`, `.d.ts`, and `.d.ts.map`

### What is mock / no-op

- No `packages/blu-*` package ships stubs
- Empty dirs `packages/hooks`, `packages/icons`, `packages/integrate`, `packages/templates` remain outside the workspace glob and are inert

### What is incomplete

- Stage 2 is not yet complete; Sprint 5 (`blu-context`) and Sprint 6 (`blu-devtools`) remain before the Stage 2 gate
- No per-package `CHANGELOG.md` files yet
- No ESLint config yet; `pnpm lint` is currently a Prettier check
- `blu-slate` is still in-memory only; IndexedDB persistence remains open for the Stage 1 gate path
- `blu-wire` currently emits transport-local lifecycle events; higher-layer projection of those onto the bus is still a later wiring concern

### Known errors / warnings

- None. All required verification commands are currently green.

### Verification run and results

```text
pnpm install
  -> workspace dependencies installed successfully
  note: on this Windows checkout, adding `packages/blu-wire` again required a
         one-time `pnpm install --force --config.confirmModulesPurge=false`
         relink so the new workspace package was wired cleanly

pnpm -r build
  -> 6 packages built clean
     blu-core, blu-schema, blu-validate, blu-bus, blu-slate, blu-wire

pnpm -r typecheck
  -> 6 packages clean

pnpm -r test
  -> 145 / 145 passing
     blu-core     51 / 51   (7 files)
     blu-schema   11 / 11   (1 file)
     blu-validate 58 / 58   (8 files)
     blu-bus       9 /  9   (1 file)
     blu-slate     9 /  9   (1 file)
     blu-wire      7 /  7   (1 file)

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

## Sprint 5 - Next Work

**Status: Ready to Start**

### Goal

Deliver `@kitsy/blu-context` and the React binding: `<BluProvider>`, `useEmit`, `useProjection`, `useDataSource`, `useSlate`, `useBus`, `useEventSubscription`.

Per `docs/blu/execution.md` section 2.1, "Sprint 5 - blu-context and the React binding".

### Reference docs

- `docs/blu/execution.md` section 2.1 (Sprint 5), section 3 (dependency rules), section 4 (quality rules)
- `docs/blu/specification.md` sections 7, 8, and 16
- `docs/blu/architecture.md` section 6.2 (`blu-context`)
- `packages/blu-bus/src/bus.ts`
- `packages/blu-slate/src/slate.ts`
- `packages/blu-wire/src/transport.ts`

### Tasks

1. Scaffold `packages/blu-context/` with `package.json`, TS configs, and Vitest config.
2. Implement `<BluProvider>` wiring for bus and slate instances.
3. Implement hooks:
   - `useEmit`
   - `useProjection`
   - `useDataSource`
   - `useSlate`
   - `useBus`
   - `useEventSubscription`
4. Ensure correct subscription cleanup and minimal re-render behavior.
5. Add tests for:
   - provider wiring
   - re-render correctness
   - unmount cleanup
   - context nesting

### Acceptance Criteria

Per `docs/blu/execution.md` Sprint 5 exit criteria:

- A React component mounted under `<BluProvider>` can emit, read projections, and update DOM in response to events
- Re-renders fire only when the consumed projection changes, verified by render counters
- A parent projection subscription does not cause child re-renders if the child reads a different projection
- Tests cover provider wiring, re-render correctness, unmount cleanup, and context nesting

---

## Later Sprints

Listed for orientation only. Do not implement ahead.

- Sprint 6 - `blu-devtools`
- Stage 2 gate - React app under provider can emit events, read projections, cross-tab sync, and inspect itself in devtools
- Sprint 7 - `blu-view`
- Sprint 8 - schema actions, data sources, forms
- Sprint 9 - `blu-shell` plus view library packages
- Sprint 10 - `blu-route`, `blu-cli`, release hardening

---

## 5. Immediate Next-Agent Instructions

1. Read `docs/handover/OPUS_HANDOVER.md` first.
2. Then read, in order:
   - `docs/blu/foundation.md`
   - `docs/blu/architecture.md`
   - `docs/blu/specification.md` (focus on slate API, bus API, transport contract, React hooks)
   - `docs/blu/execution.md` section 2.1 (Sprint 5) and section 3 (dependency rules)
3. Inspect the Stage 2 deliverables before writing Sprint 5 code:
   - `packages/blu-bus/src/bus.ts`
   - `packages/blu-slate/src/slate.ts`
   - `packages/blu-wire/src/transport.ts`
4. Implement Sprint 5 only. Do not start Sprint 6.
5. Files to edit: new files under `packages/blu-context/` only, unless Sprint 5 exposes a real bug in an earlier package.
6. Files not to touch unless a real bug forces it:
   - `packages/blu-core/`
   - `packages/blu-schema/`
   - `packages/blu-validate/`
   - `packages/blu-bus/`
   - `packages/blu-slate/`
   - `packages/blu-wire/`
   - root tooling files
   - anything under `docs/` other than this handover update
7. Verification commands that must pass before reporting done:

```text
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm lint
```

Existing 145 tests must remain green. Sprint 5 must add coverage for `blu-context`.

---

## 6. Non-Negotiable Guardrails

- Do not redesign the architecture.
- Do not refactor unrelated code.
- `blu-context` imports `@kitsy/blu-core`, `@kitsy/blu-bus`, `@kitsy/blu-slate`, and React only.
- Preserve the bus/slate/context split: `blu-context` is thin wiring, not a place to absorb runtime logic from lower layers.
- Preserve the existing event, projection, replay, and transport contracts.
- Keep `ESM-only`, `sideEffects: false`, TS strict, no `any` in public signatures.
- Do not create package README or CLAUDE files unless explicitly asked.
- If a real bug in an earlier package forces a change, document it in section 3 before proceeding.

---

## 7. Open Questions

| Question | Current leaning | Needed before |
|---|---|---|
| Should `<BluProvider>` construct default bus/slate instances or require them as explicit props? | Prefer explicit props first to keep the provider honest and testable; add defaults only if the Sprint 5 ergonomics demand them. | Sprint 5 provider API design |
| How should `useProjection()` minimize re-renders with the current slate subscription surface? | Start with subscription-per-hook and local state updates keyed to one projection; avoid broader context invalidation. | Sprint 5 hook implementation |
| Should `useEventSubscription()` use the raw bus filter types directly or wrap them in React-specific helpers? | Use the raw bus filter contract directly to avoid creating a second mental model. | Sprint 5 hook API design |
| Where should `sync:transport:error` and `sync:session:resumed` become visible to app code? | Keep them transport-local in `blu-wire` for now and bridge them onto the bus at the integration layer when `blu-context` or a later layer owns that wiring. | Sprint 5 or Sprint 6 integration decision |
| Is IndexedDB persistence required before the Stage 2 gate, or can the gate initially proceed with in-memory slate plus transport? | The slate is still in-memory only; defer persistence unless the Stage 1 or Stage 2 gate explicitly forces it first. | Stage gate planning |
| ESLint config - adopt now or after Sprint 5? | After Sprint 5. Prettier-only lint is still sufficient for now. | Stage 2 gate |
| Per-package `CHANGELOG.md`? | Add at first publish, not now. | First alpha publish |

---

## 8. Ready Prompt for Next Agent

Copy-paste prompt for the next coding agent:

---

> You are continuing work on the Blu framework (event-first, schema-driven UI). Sprint 1 through Sprint 4 are complete; this handover reflects the current repo state after `@kitsy/blu-wire`.
>
> **Step 1 - Read these in order, no skipping:**
> 1. `docs/handover/OPUS_HANDOVER.md` (full file)
> 2. `docs/blu/foundation.md`
> 3. `docs/blu/architecture.md`
> 4. `docs/blu/specification.md` (focus on slate API, bus API, transport contract, and React hooks)
> 5. `docs/blu/execution.md` section 2.1 (Sprint 5 spec) and section 3 (dependency rules)
> 6. `packages/blu-bus/src/bus.ts`
> 7. `packages/blu-slate/src/slate.ts`
> 8. `packages/blu-wire/src/transport.ts`
>
> **Step 2 - Scope:** Implement **Sprint 5 only** - `@kitsy/blu-context`. The full task list and acceptance criteria are in `docs/handover/OPUS_HANDOVER.md` section 4 "Sprint 5 - Next Work".
>
> **Step 3 - Guardrails (do not violate):**
> - Do not redesign the architecture. Do not refactor unrelated code.
> - Do not modify `packages/blu-core/`, `packages/blu-schema/`, `packages/blu-validate/`, `packages/blu-bus/`, `packages/blu-slate/`, or `packages/blu-wire/` unless you find a real bug - and if you do, document it in the handover before proceeding.
> - `blu-context` imports only `@kitsy/blu-core`, `@kitsy/blu-bus`, `@kitsy/blu-slate`, and React.
> - Preserve the bus/slate/context split. `blu-context` is thin wiring, not a place to absorb lower-layer runtime logic.
> - TypeScript strict, ESM-only, `sideEffects: false`, no `any` in public signatures, JSDoc on public functions, >=80% coverage, vitest only.
> - Workspace package name pattern is `@kitsy/blu-*`, version `1.0.0-dev.0`.
> - Do not create CLAUDE.md or README files unless explicitly asked.
>
> **Step 4 - Files you will create:** new files under `packages/blu-context/` only (`package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `src/*.ts`, `src/*.test.ts`).
>
> **Step 5 - Verification (must all pass before you report done):**
> ```
> pnpm install
> pnpm -r build
> pnpm -r typecheck
> pnpm -r test     # existing 145 tests must remain green; Sprint 5 must add coverage
> pnpm lint
> ```
>
> **Step 6 - Update the handover.** When Sprint 5 is complete, edit `docs/handover/OPUS_HANDOVER.md`:
> - Move Sprint 5 from "Next Work" to "Current Completed Work" (mark as Done with file list and verification output).
> - Add Sprint 6 (`blu-devtools`) as the new "Next Work" using the spec in `docs/blu/execution.md` section 2.1.
> - Update section 3 "Current Repo State" with the new package and refreshed test counts.
> - Resolve or update section 7 "Open Questions" based on choices you made.
>
> Begin by reading the handover, then proceed.
