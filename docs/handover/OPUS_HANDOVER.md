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

Sprint 1, Sprint 2, and Sprint 3 are now complete:

- Sprint 1: `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-validate`
- Sprint 2: `@kitsy/blu-bus`
- Sprint 3: `@kitsy/blu-slate`

Sprint 4 (`@kitsy/blu-wire`) is next.

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

- `docs/blu/execution.md` section 2.1 - Sprint 4 (`blu-wire`) spec and exit criteria
- `docs/blu/execution.md` section 3 - dependency rules
- `docs/blu/specification.md` sections 1, 3, 4, 7, and 9 - envelope, durability, origin/causality, slate API, transport contract
- `packages/blu-core/src/event.ts`, `durability.ts`, `index.ts`
- `packages/blu-slate/src/slate.ts`

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

### Files modified

- `packages/blu-core/src/event.ts`
  Fixed a real Sprint 1 type bug during Sprint 2: `PartialEvent<T>` now makes `causationId`, `correlationId`, `scopePath`, and `origin` truly optional, matching the documented bus contract.
- `pnpm-lock.yaml`
  Updated as new workspace packages were added.

### Components / modules added

- `@kitsy/blu-core`
- `@kitsy/blu-schema`
- `@kitsy/blu-validate`
- `@kitsy/blu-bus`
- `@kitsy/blu-slate`

### What is wired

- `pnpm install` works; lockfile present at `pnpm-lock.yaml`
- `turbo` orchestrates build / test / typecheck across the workspace
- `@kitsy/blu-bus` imports only `@kitsy/blu-core` and `@kitsy/blu-validate`
- `@kitsy/blu-slate` imports only `@kitsy/blu-core`
- All five workspace packages emit `dist/` with `.js`, `.d.ts`, and `.d.ts.map`

### What is mock / no-op

- No `packages/blu-*` package ships stubs
- Empty dirs `packages/hooks`, `packages/icons`, `packages/integrate`, `packages/templates` remain outside the workspace glob and are inert

### What is incomplete

- Stage 1 is not yet complete; Sprint 4 (`blu-wire`) remains before the Stage 1 gate
- No per-package `CHANGELOG.md` files yet
- No ESLint config yet; `pnpm lint` is currently a Prettier check
- `blu-slate` is in-memory only for now; IndexedDB persistence is still open for the Stage 1 gate path

### Known errors / warnings

- None. All required verification commands are currently green.

### Verification run and results

```text
pnpm install
  -> workspace dependencies installed successfully

pnpm -r build
  -> 5 packages built clean
     blu-core, blu-schema, blu-validate, blu-bus, blu-slate

pnpm -r typecheck
  -> 5 packages clean

pnpm -r test
  -> 138 / 138 passing
     blu-core     51 / 51   (7 files)
     blu-schema   11 / 11   (1 file)
     blu-validate 58 / 58   (8 files)
     blu-bus       9 /  9   (1 file)
     blu-slate     9 /  9   (1 file)

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
- Added a focused 9-test Sprint 3 suite covering:
  - journal ordering and filtering
  - projection registration and memoization
  - authority rejection paths
  - snapshot + compaction round-trip
  - replay fidelity
  - derived projection recomputation without journal churn
  - pending-sequence assignment
  - duplicate event handling

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

## Sprint 4 - Next Work

**Status: Ready to Start**

### Goal

Deliver `@kitsy/blu-wire` - the transport contract and the first two adapters: `LocalTransport` and `BroadcastChannelTransport`, with idempotent receive, connection lifecycle, and status eventing.

Per `docs/blu/execution.md` section 2.1, "Sprint 4 - blu-wire".

### Reference docs

- `docs/blu/execution.md` section 2.1 (Sprint 4), section 3 (dependency rules), section 4 (quality rules)
- `docs/blu/specification.md` sections 3, 7, and 9
- `docs/blu/architecture.md` section 7.1 (`blu-wire`)
- `packages/blu-core/src/event.ts`, `durability.ts`, `index.ts`
- `packages/blu-slate/src/slate.ts`

### Tasks

1. Scaffold `packages/blu-wire/` with `package.json`, TS configs, and Vitest config.
2. Define the transport contract and public transport types.
3. Implement `LocalTransport` for in-process transport testing.
4. Implement `BroadcastChannelTransport` for cross-tab browser transport.
5. Ensure idempotent receive paths and transport lifecycle/status handling.
6. Add tests for:
   - cross-instance propagation
   - duplicate event deduplication on the receiving slate
   - disconnect / reconnect behavior
   - ordering under concurrent writes

### Acceptance Criteria

Per `docs/blu/execution.md` Sprint 4 exit criteria:

- Two slates in the same process, connected by `BroadcastChannelTransport`, replicate a `replicated`-durability event in both directions with deterministic ordering
- Duplicate event IDs at the receiving slate are deduplicated silently
- Transport disconnection emits `sync:transport:error`; reconnection emits `sync:session:resumed`
- Tests cover cross-tab propagation, idempotency, disconnection behavior, and ordering under concurrent writes

---

## Later Sprints

Listed for orientation only. Do not implement ahead.

- Stage 2 gate - React app under provider can emit events, read projections, cross-tab sync, and inspect itself in devtools
- Sprint 5 - `blu-context`
- Sprint 6 - `blu-devtools`
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
   - `docs/blu/specification.md` (focus on durability, causality, slate API, transport contract)
   - `docs/blu/execution.md` section 2.1 (Sprint 4) and section 3 (dependency rules)
3. Inspect the Stage 1 deliverables before writing Sprint 4 code:
   - `packages/blu-core/src/event.ts`, `durability.ts`, `index.ts`
   - `packages/blu-slate/src/slate.ts`
4. Implement Sprint 4 only. Do not start Sprint 5.
5. Files to edit: new files under `packages/blu-wire/` only, unless Sprint 4 exposes a real bug in an earlier package.
6. Files not to touch unless a real bug forces it:
   - `packages/blu-core/`
   - `packages/blu-schema/`
   - `packages/blu-validate/`
   - `packages/blu-bus/`
   - `packages/blu-slate/`
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

Existing 138 tests must remain green. Sprint 4 must add coverage for `blu-wire`.

---

## 6. Non-Negotiable Guardrails

- Do not redesign the architecture.
- Do not refactor unrelated code.
- `blu-wire` may import only `@kitsy/blu-core`.
- Preserve the bus/slate/transport split: `blu-wire` defines transports and does not absorb slate logic.
- Preserve the event, durability, causality, and transport contracts from the specification.
- Keep `ESM-only`, `sideEffects: false`, TS strict, no `any` in public signatures.
- Do not create package README or CLAUDE files unless explicitly asked.
- If a real bug in an earlier package forces a change, document it in section 3 before proceeding.

---

## 7. Open Questions

| Question | Current leaning | Needed before |
|---|---|---|
| Should `LocalTransport` deliver offered events synchronously or queue them to the next microtask? | Start synchronous for determinism in tests unless ordering bugs force queueing. | Sprint 4 LocalTransport implementation |
| How should `BroadcastChannelTransport` expose status in non-browser test environments? | Provide a transport-level status state machine and gate the actual channel creation behind environment checks or injectable constructors. | Sprint 4 testability design |
| Where should `sync:transport:error` and `sync:session:resumed` be emitted if `blu-wire` cannot import `blu-bus`? | Keep transport status as transport-local state/events first; let later wiring layers project them onto the bus/slate boundary. | Sprint 4 lifecycle design |
| Is IndexedDB persistence required before the Stage 1 gate, or can the gate initially be demonstrated with in-memory slate plus snapshot/compaction/replay? | The current slate is in-memory only; IndexedDB should be deferred unless the Stage 1 gate explicitly requires it before Sprint 4 closes. | Stage 1 gate planning |
| ESLint config - adopt now or after Sprint 4? | After Sprint 4. Prettier-only lint is still sufficient for now. | Stage 1 gate |
| Per-package `CHANGELOG.md`? | Add at first publish, not now. | First alpha publish |

---

## 8. Ready Prompt for Next Agent

Copy-paste prompt for the next coding agent:

---

> You are continuing work on the Blu framework (event-first, schema-driven UI). Sprint 1, Sprint 2, and Sprint 3 are complete; this handover reflects the current repo state after `@kitsy/blu-slate`.
>
> **Step 1 - Read these in order, no skipping:**
> 1. `docs/handover/OPUS_HANDOVER.md` (full file)
> 2. `docs/blu/foundation.md`
> 3. `docs/blu/architecture.md`
> 4. `docs/blu/specification.md` (focus on durability, causality, slate API, and transport contract)
> 5. `docs/blu/execution.md` section 2.1 (Sprint 4 spec) and section 3 (dependency rules)
> 6. `packages/blu-core/src/event.ts`, `durability.ts`, `index.ts`
> 7. `packages/blu-slate/src/slate.ts`
>
> **Step 2 - Scope:** Implement **Sprint 4 only** - `@kitsy/blu-wire`. The full task list and acceptance criteria are in `docs/handover/OPUS_HANDOVER.md` section 4 "Sprint 4 - Next Work".
>
> **Step 3 - Guardrails (do not violate):**
> - Do not redesign the architecture. Do not refactor unrelated code.
> - Do not modify `packages/blu-core/`, `packages/blu-schema/`, `packages/blu-validate/`, `packages/blu-bus/`, or `packages/blu-slate/` unless you find a real bug - and if you do, document it in the handover before proceeding.
> - `blu-wire` may import only `@kitsy/blu-core`.
> - Preserve the bus/slate/transport split. `blu-wire` defines transports and does not absorb slate logic.
> - TypeScript strict, ESM-only, `sideEffects: false`, no `any` in public signatures, JSDoc on public functions, >=80% coverage, vitest only.
> - Workspace package name pattern is `@kitsy/blu-*`, version `1.0.0-dev.0`.
> - Do not create CLAUDE.md or README files unless explicitly asked.
>
> **Step 4 - Files you will create:** new files under `packages/blu-wire/` only (`package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `src/*.ts`, `src/*.test.ts`).
>
> **Step 5 - Verification (must all pass before you report done):**
> ```
> pnpm install
> pnpm -r build
> pnpm -r typecheck
> pnpm -r test     # existing 138 tests must remain green; Sprint 4 must add coverage
> pnpm lint
> ```
>
> **Step 6 - Update the handover.** When Sprint 4 is complete, edit `docs/handover/OPUS_HANDOVER.md`:
> - Move Sprint 4 from "Next Work" to "Current Completed Work" (mark as Done with file list and verification output).
> - Add Sprint 5 (`blu-context`) as the new "Next Work" using the spec in `docs/blu/execution.md` section 2.1.
> - Update section 3 "Current Repo State" with the new package and refreshed test counts.
> - Resolve or update section 7 "Open Questions" based on choices you made.
>
> Begin by reading the handover, then proceed.
