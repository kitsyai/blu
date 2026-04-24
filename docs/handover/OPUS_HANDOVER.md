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

Sprint 1 and Sprint 2 are now complete:

- Sprint 1: `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-validate`
- Sprint 2: `@kitsy/blu-bus`

Sprint 3 (`@kitsy/blu-slate`) is next.

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
| `docs/blu/specification.md` | Canonical | Envelope, causality, authority, projection, slate, bus |
| `docs/blu/execution.md` | Canonical | Sprint sequence, dependency rules, quality rules |
| `docs/blu/shell.md` | Canonical | Needed later in Sprint 9 |
| `docs/governance.md` | Supporting | Repo governance |
| `docs/handover/OPUS_HANDOVER.md` | This file | Current repo state and next-agent guidance |

**Critical sections for the next agent:**

- `docs/blu/execution.md` section 2.1 - Sprint 3 (`blu-slate`) spec and exit criteria
- `docs/blu/execution.md` section 3 - dependency rules
- `docs/blu/specification.md` sections 4, 5, 6, and 7 - causality, projection contract, authority, Slate API
- `packages/blu-core/src/projection.ts`, `authority.ts`, `event.ts`
- `packages/blu-bus/src/bus.ts`

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

### Files modified

- `packages/blu-core/src/event.ts`
  Fixed a real Sprint 1 type bug: `PartialEvent<T>` now makes `causationId`, `correlationId`, `scopePath`, and `origin` truly optional, matching the documented bus contract.
- Existing Sprint 1 `src/**/*.ts` files were Prettier-normalized so `pnpm lint` passes under the current workspace toolchain.

### Components / modules added

- `@kitsy/blu-core`
- `@kitsy/blu-schema`
- `@kitsy/blu-validate`
- `@kitsy/blu-bus`

### What is wired

- `pnpm install` works; lockfile present at `pnpm-lock.yaml`
- `turbo` orchestrates build / test / typecheck across the workspace
- `@kitsy/blu-bus` imports only `@kitsy/blu-core` and `@kitsy/blu-validate`
- All four workspace packages emit `dist/` with `.js`, `.d.ts`, and `.d.ts.map`

### What is mock / no-op

- No `packages/blu-*` package ships stubs
- Empty dirs `packages/hooks`, `packages/icons`, `packages/integrate`, `packages/templates` remain outside the workspace glob and are inert

### What is incomplete

- Stage 1 is not yet complete; Sprint 3 (`blu-slate`) remains
- No per-package `CHANGELOG.md` files yet
- No ESLint config yet; `pnpm lint` is currently a Prettier check

### Known errors / warnings

- None. All required verification commands are currently green.

### Verification run and results

```text
pnpm install
  -> workspace dependencies installed successfully
  note: because `packages/blu-bus` was added in this checkout, a one-time
         `pnpm install --force --config.confirmModulesPurge=false` relink
         was needed on Windows so the new workspace package was wired cleanly

pnpm -r build
  -> 4 packages built clean
     blu-core, blu-schema, blu-validate, blu-bus

pnpm -r typecheck
  -> 4 packages clean

pnpm -r test
  -> 129 / 129 passing
     blu-core     51 / 51   (7 files)
     blu-schema   11 / 11   (1 file)
     blu-validate 58 / 58   (8 files)
     blu-bus       9 /  9   (1 file)

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

## Sprint 3 - Next Work

**Status: Ready to Start**

### Goal

Deliver `@kitsy/blu-slate` - the journal, projection engine, authority enforcement layer, snapshot/compaction hooks, and replay behavior.

Per `docs/blu/execution.md` section 2.1, "Sprint 3 - blu-slate".

### Reference docs

- `docs/blu/execution.md` section 2.1 (Sprint 3), section 3 (dependency rules), section 4 (quality rules)
- `docs/blu/specification.md` sections 4, 5, 6, and 7
- `docs/blu/architecture.md` section 4.2 (`blu-slate`)
- `packages/blu-core/src/projection.ts`, `authority.ts`, `event.ts`, `durability.ts`, `origin.ts`, `index.ts`
- `packages/blu-bus/src/bus.ts`

### Tasks

1. Scaffold `packages/blu-slate/` with `package.json`, TS configs, and Vitest config.
2. Implement the Slate API:
   - projection registration / unregistration
   - projection reads and subscriptions
   - append path for finalized `BluEvent`s
   - journal iteration
   - snapshot and compaction handles
   - replay with `origin: "replay"`
3. Implement the projection engine:
   - deterministic reduction from `initialState`
   - event filtering and optional scope filtering
   - subscriber notification only on change
4. Implement authority enforcement according to the specification.
5. Add tests for journal ordering, projection memoization, authority rejection paths, snapshot round-trip, replay fidelity, and projection subscriptions.

### Acceptance Criteria

Per `docs/blu/execution.md` Sprint 3 exit criteria:

- Registering a projection and emitting events drives the reducer correctly, with memoized output
- Authority is enforced: writes to `server-authoritative` projections without a fact event are rejected
- Snapshot and compaction round-trip works
- Replay dispatches with `origin: "replay"`
- Derived projections recompute when their sources change, without journal churn
- Tests cover journal ordering, projection memoization, authority rejection paths, snapshot round-trip, and replay fidelity

---

## Later Sprints

Listed for orientation only. Do not implement ahead.

- Stage 1 gate - harness can register projections, emit through the bus, observe state, persist, reload, and observe identical state. No React.
- Sprint 4 - `blu-wire`
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
   - `docs/blu/specification.md` (focus on causality, projection contract, authority, Slate API)
   - `docs/blu/execution.md` section 2.1 (Sprint 3) and section 3 (dependency rules)
3. Inspect the Stage 1 deliverables before writing Sprint 3 code:
   - `packages/blu-core/src/event.ts`, `projection.ts`, `authority.ts`, `durability.ts`, `origin.ts`, `index.ts`
   - `packages/blu-bus/src/bus.ts`
4. Implement Sprint 3 only. Do not start Sprint 4.
5. Files to edit: new files under `packages/blu-slate/` only, unless Sprint 3 exposes a real bug in an earlier package.
6. Files not to touch unless a real bug forces it:
   - `packages/blu-core/`
   - `packages/blu-schema/`
   - `packages/blu-validate/`
   - `packages/blu-bus/`
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

Existing 129 tests must remain green. Sprint 3 must add coverage for `blu-slate`.

---

## 6. Non-Negotiable Guardrails

- Do not redesign the architecture.
- Do not refactor unrelated code.
- `blu-slate` may import only `@kitsy/blu-core`.
- Preserve the bus/slate split: the slate does not import the bus.
- Preserve the event, projection, authority, and replay contracts from the specification.
- Replay must surface `origin: "replay"`.
- Keep `ESM-only`, `sideEffects: false`, TS strict, no `any` in public signatures.
- Do not create package README or CLAUDE files unless explicitly asked.
- If a real bug in an earlier package forces a change, document it in section 3 before proceeding.

---

## 7. Open Questions

| Question | Current leaning | Needed before |
|---|---|---|
| Should `slate.append(event)` preserve the bus-assigned `sequence`, or assign one only when the incoming event is still at the core placeholder (`-1`)? | Preserve the bus-assigned sequence on normal append paths; only direct slate appends of pending events should need assignment logic. | Sprint 3 append implementation |
| What is the smallest useful snapshot handle shape for Sprint 3? | A global snapshot handle keyed by projection name and journal position is enough for the first pass. | Sprint 3 snapshot design |
| What equality policy should projection subscriptions use for change notification? | Identity first, with a shallow-object fast path only if the spec forces it. | Sprint 3 subscription implementation |
| Is IndexedDB persistence required inside Sprint 3 itself, or can Sprint 3 land the in-memory journal plus snapshot/compaction/replay contracts first? | Start with the in-memory journal and add IndexedDB only if the acceptance tests or stage-gate harness demand it immediately. | Sprint 3 scoping |
| ESLint config - adopt now or after Sprint 3? | After Sprint 3. Prettier-only lint is sufficient for now. | Stage 1 gate |
| Per-package `CHANGELOG.md`? | Add at first publish, not now. | First alpha publish |

---

## 8. Ready Prompt for Next Agent

Copy-paste prompt for the next coding agent:

---

> You are continuing work on the Blu framework (event-first, schema-driven UI). Sprint 1 and Sprint 2 are complete; this handover reflects the current repo state after `@kitsy/blu-bus`.
>
> **Step 1 - Read these in order, no skipping:**
> 1. `docs/handover/OPUS_HANDOVER.md` (full file)
> 2. `docs/blu/foundation.md`
> 3. `docs/blu/architecture.md`
> 4. `docs/blu/specification.md` (focus on causality, projection contract, authority, and Slate API)
> 5. `docs/blu/execution.md` section 2.1 (Sprint 3 spec) and section 3 (dependency rules)
> 6. `packages/blu-core/src/event.ts`, `projection.ts`, `authority.ts`, `durability.ts`, `origin.ts`, `index.ts`
> 7. `packages/blu-bus/src/bus.ts`
>
> **Step 2 - Scope:** Implement **Sprint 3 only** - `@kitsy/blu-slate`. The full task list and acceptance criteria are in `docs/handover/OPUS_HANDOVER.md` section 4 "Sprint 3 - Next Work".
>
> **Step 3 - Guardrails (do not violate):**
> - Do not redesign the architecture. Do not refactor unrelated code.
> - Do not modify `packages/blu-core/`, `packages/blu-schema/`, `packages/blu-validate/`, or `packages/blu-bus/` unless you find a real bug - and if you do, document it in the handover before proceeding.
> - `blu-slate` may import only `@kitsy/blu-core`.
> - Preserve the bus/slate split. The slate does not import the bus.
> - Replay must surface `origin: "replay"`.
> - TypeScript strict, ESM-only, `sideEffects: false`, no `any` in public signatures, JSDoc on public functions, >=80% coverage, vitest only.
> - Workspace package name pattern is `@kitsy/blu-*`, version `1.0.0-dev.0`.
> - Do not create CLAUDE.md or README files unless explicitly asked.
>
> **Step 4 - Files you will create:** new files under `packages/blu-slate/` only (`package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `src/*.ts`, `src/*.test.ts`).
>
> **Step 5 - Verification (must all pass before you report done):**
> ```
> pnpm install
> pnpm -r build
> pnpm -r typecheck
> pnpm -r test     # existing 129 tests must remain green; Sprint 3 must add coverage
> pnpm lint
> ```
>
> **Step 6 - Update the handover.** When Sprint 3 is complete, edit `docs/handover/OPUS_HANDOVER.md`:
> - Move Sprint 3 from "Next Work" to "Current Completed Work" (mark as Done with file list and verification output).
> - Add Sprint 4 (`blu-wire`) as the new "Next Work" using the spec in `docs/blu/execution.md` section 2.1.
> - Update section 3 "Current Repo State" with the new package and refreshed test counts.
> - Resolve or update section 7 "Open Questions" based on choices you made.
>
> Begin by reading the handover, then proceed.
