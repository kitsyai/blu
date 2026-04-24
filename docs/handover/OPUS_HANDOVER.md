# Opus Handover

**Date:** 2026-04-24
**From:** Claude Opus 4.7 (chat ending due to token limits)
**To:** Next coding agent (Sonnet / OpenAI Codex)
**Repo:** `kitsy-blu-workspace` — root at `/sessions/laughing-festive-ramanujan/mnt/blu`
**Current version:** `1.0.0-dev.0` (workspace root `1.0.0-dev`)

---

## 1. Project Context

### What we are building

**Blu** is an event-first, schema-driven UI framework — the foundation layer of the Kitsy platform. It pairs an **event-sourced runtime** (event journal + projections) with a **schema-described view tree** (`ApplicationConfiguration`). Applications are authored as data, not code, and run on top of a deterministic projection engine.

This handover covers the **Blu** monorepo only. Other Kitsy products (Studio, Mind, Server, Platform) are separate tracks and out of scope.

### Module ownership for this work

Sprint 1 work is constrained to the **Layer 1 Primitives**:
- `@kitsy/blu-core` — event envelope, classifications (class, durability, origin, authority), causality, projection contract, ULID generator.
- `@kitsy/blu-schema` — types-only schema vocabulary (ApplicationConfiguration, ViewNode, DataSource, FormDefinition, Action, Condition, ComponentMeta, etc.).
- `@kitsy/blu-validate` — runtime validators returning `Result<T>` (no throws).

### High-level architecture direction

Blu is built strictly **bottom-up** in 10 sprints across 4 stages, per `docs/blu/execution.md`:

1. **Stage 1 — Primitives & Backbone:** blu-core, blu-schema, blu-validate (Sprint 1 ✅) → blu-bus (Sprint 2) → blu-slate (Sprint 3).
2. **Stage 2 — Integration:** blu-wire → blu-context (React) → blu-devtools.
3. **Stage 3 — View & Authoring:** blu-view → schema actions/data sources/forms.
4. **Stage 4 — Shell & Tooling:** blu-shell + view library → blu-route + blu-cli.

A meta-package `@kitsy/blu` re-exports the public API at the end. The eventual layout is 18 packages.

### Important product & technical principles

- **Slate-first, no facade.** The slate is the journal + projection engine; nothing wraps it.
- **No layer is built against a stubbed lower layer.** If a sprint needs the slate, it waits for Sprint 3.
- **Devtools are not deferred** — they ship in Sprint 6 alongside the first journaled events.
- **Result<T> pattern** — validators never throw; they return `{ ok: true, value }` or `{ ok: false, errors }`.
- **Causality is preserved** end-to-end through `causationId` (parent event) and `correlationId` (root event of the chain; a root event's correlationId equals its own eventId).
- **ULID event IDs:** Crockford base32, 48-bit ms timestamp + 80-bit randomness, monotonic-within-ms.
- **Six EventClasses:** `intent`, `fact`, `system`, `projection`, `sync`, `devtools`.
- **Four Durability tiers:** `ephemeral`, `observable`, `journaled`, `replicated`.
- **Five Origins:** `user`, `system`, `sync`, `replay`, `migration`.
- **Six Authorities:** `local-only`, `local-authoritative`, `projection-authoritative`, `browser-authoritative`, `server-authoritative`, `derived-only`.
- **URN component addressing:** `urn:blu:{namespace}:{name}` (e.g., `urn:blu:ui:button`).
- **TypeScript strict mode**, `noUncheckedIndexedAccess`, no `any` in public signatures.
- **ESM-only**, `sideEffects: false` on all packages.
- **80% coverage** threshold per package; vitest is the only test runner.

### What should not be changed casually

- **Dependency direction** in `docs/blu/execution.md` §3. Each layer imports only the layers below it. Violating this is rejected in review.
- **The BluEvent envelope shape** (`packages/blu-core/src/event.ts`). Other packages and the validator depend on this contract.
- **The 18-package map / branding config** (`branding.config.js` at root).
- **The Result<T> + ErrorCollector contract** in `@kitsy/blu-validate`. Child collectors share the parent's error sink — this is intentional and load-bearing for recursive validators.
- **Workspace glob** `packages/blu-*` in `pnpm-workspace.yaml` — empty stub dirs (`hooks`, `icons`, `integrate`, `templates`) sit outside this glob on purpose.

---

## 2. Source-of-Truth Docs

| File | Role | Notes |
|---|---|---|
| `docs/blu/foundation.md` | Source-of-truth | Principles. Read first. |
| `docs/blu/architecture.md` | Source-of-truth | Layering and module map. |
| `docs/blu/specification.md` | Source-of-truth | Canonical envelope, classifications, projection contract, schema types. |
| `docs/blu/execution.md` | Source-of-truth | 10-sprint plan, exit criteria, dependency rules. **Sprint 2 spec lives here, §2.1.** |
| `docs/blu/shell.md` | Source-of-truth | Shell taxonomy (consumed in Sprint 9). |
| `docs/governance.md` | Supporting reference | Repo governance / contribution rules. |
| `docs/specs/blu-component-specifications.md` | Supporting reference | Component-level spec; relevant once Sprint 7 (blu-view) starts. |
| `docs/specs/blu-product-hosting-spec.md` | Supporting reference | Hosting/deployment context. |
| `docs/specs/kitsy-mind-implementation-spec.md` | Out of scope | Other product track. |
| `docs/specs/kitsy-server-implementation-spec.md` | Out of scope | Other product track. |
| `docs/specs/kitsy-studio-implementation-spec.md` | Out of scope | Other product track. |
| `docs/impl/kitsy-*-execution-pack.md` | Out of scope | Other product tracks. |
| `docs/reference/kitsy-platform-architecture.md` | Background | Higher-level Kitsy context. |
| `docs/handover/OPUS_HANDOVER.md` | This file | The handover for the next agent. |

**Critical sections for the next agent:**
- `docs/blu/execution.md` §2.1 — Sprint 2 (blu-bus) spec & exit criteria.
- `docs/blu/execution.md` §3 — Dependency rules. Sprint 2 must follow these (`blu-bus` imports only `blu-core` and `blu-validate`).
- `docs/blu/execution.md` §4 — Quality rules (TS strict, JSDoc on public functions, 80% coverage, no `any`).
- `docs/blu/specification.md` — envelope, classifications, projection contract.

---

## 3. Current Repo State

### Files created (Sprint 1)

**Root tooling:**
- `package.json` — workspace root, `1.0.0-dev`, scripts: build / test / typecheck / lint / format / clean / fresh. devDeps: typescript 5.8.3, vitest 4.0.16, prettier 3.6.2, turbo 2.5.5, tsx, rimraf, @types/node.
- `pnpm-workspace.yaml` — `packages: - 'packages/blu-*'`.
- `turbo.json` — build/typecheck/test/clean tasks with `^build` deps and `dist/**` outputs.
- `tsconfig.base.json` — target ES2022, moduleResolution `bundler`, strict, `declaration: true`, `declarationMap: true`, `noUncheckedIndexedAccess: true`.
- `vitest.config.ts` — projects `["packages/blu-*"]`, 80% coverage thresholds.
- `branding.config.js` + `.d.ts` — 18-package metadata map.

**`packages/blu-core/` (Layer 1 Primitives, 1.0.0-dev.0):**
- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `src/event.ts` — `BluEvent<TPayload>` and `PartialEvent<TPayload>` interfaces.
- `src/event-id.ts` — `createEventId()`, `isEventId()`, `eventIdTimestamp()` (ULID, monotonic-within-ms).
- `src/envelope.ts` — `applyEnvelopeDefaults()` (fills eventId, timestamp, sequence placeholder, root correlationId).
- `src/causality.ts` — `propagateCausality(parent, child)`, `isCausalRoot()`.
- `src/event-class.ts`, `src/durability.ts`, `src/origin.ts`, `src/authority.ts` — enum types + tuple constants + `isX` predicates + helper functions (`isJournaledTier`, `isReplicatedTier`, `authorityRequiresJournal`, `authorityAcceptsReplication`).
- `src/projection.ts` — `Projection<TState, TEvent>`, `ProjectionHandle<TState>`, `ProjectionSnapshotPolicy<TState>`, `Unsubscribe` types.
- `src/index.ts` — re-exports.
- 7 test files: `authority.test.ts`, `causality.test.ts`, `durability.test.ts`, `envelope.test.ts`, `event-class.test.ts`, `event-id.test.ts`, `origin.test.ts`.

**`packages/blu-schema/` (Layer 1 Schema, types-only, 1.0.0-dev.0):**
- `src/application.ts` — `ApplicationConfiguration` (id, name, version, entry, routes, theme, dataSources, projections, eventRegistry, meta).
- `src/view-node.ts` — `ViewNode`, `RepeatDirective`, `ViewReference`.
- `src/value.ts` — `Value`, `BindingRef` (`$bind`), `NamedRef` (`$ref`), `PropValue`, `Binding`.
- `src/condition.ts` — `Condition` (12 operators).
- `src/action.ts` — `Action` union (Navigate, Emit, Form, Composite).
- `src/form.ts` — `FormDefinition`, `FormField`, `FieldValidation`, `ValidationRule`.
- `src/data-source.ts` — `DataSource` union (Rest, GraphQL, Static, Bus, Projection) + `DataSourceRegistration`.
- `src/component-meta.ts` — `ComponentMeta`, `PropSchema` variants, `EventSchema`, `SlotSchema`.
- `src/route.ts`, `src/theme.ts`, `src/registration.ts`.
- `src/index.test.ts` — 11 compile-time type-shape guards.

**`packages/blu-validate/` (Layer 1 Validation, 1.0.0-dev.0):**
- `src/result.ts` — `Result<T>`, `ValidationError`, `ok` / `err` / `makeError`, **`ErrorCollector`** (child collectors share parent's `#errors` sink — load-bearing for recursive validators).
- `src/event.ts` — `validateEvent` (finalized) + `validatePartialEvent`.
- `src/action.ts` — `validateAction` + `validateActionInto`, recursive for composite.
- `src/view-node.ts` — `validateViewNode` + `validateViewNodeInto` + `validateBindingInto`, recursive over children.
- `src/data-source.ts` — `validateDataSource` discriminating on `kind`.
- `src/form.ts` — `validateFormDefinition` (field type, enum, validation rules).
- `src/component-meta.ts` — URN / category / semver / props checks.
- `src/application.ts` — full traversal: view-reference, route, dataSource, projection, eventRegistry.
- 8 test files (one per source module + `result.test.ts`).

### Files modified

None outside Sprint 1 scope. The previous codebase was torn down into clean slate per user instruction.

### Components / modules added

The three Sprint 1 packages above. No React, no view rendering, no bus, no slate yet — those are later sprints.

### What is wired

- `pnpm install` works, lockfile present (`pnpm-lock.yaml`).
- `turbo` orchestrates build / test / typecheck across the workspace.
- `blu-validate` depends on `blu-core` and `blu-schema` via workspace protocol; `blu-schema` depends on `blu-core`.
- All three packages emit `dist/` with `.js`, `.d.ts`, `.d.ts.map`.

### What is mock / no-op

- **Nothing.** Sprint 1 ships real implementations; no stubs are carried.
- Empty stub dirs `packages/hooks`, `packages/icons`, `packages/integrate`, `packages/templates` exist on disk but are excluded by the `packages/blu-*` workspace glob and are inert.

### What is incomplete

- Stage 1 is not yet complete — Sprint 2 (`blu-bus`) and Sprint 3 (`blu-slate`) remain.
- No CHANGELOG files in any package yet (quality rule §4 — to add when packages near publish).
- No ESLint config yet — Prettier-only check is what `pnpm lint` runs today.

### Known errors / warnings

- **None.** All builds, typechecks, and tests are green as of this handover.

### Build / test commands run and results

```
pnpm install                    → 66 packages installed, no errors
pnpm -r build                   → 3 packages built clean (blu-core, blu-schema, blu-validate)
pnpm -r typecheck               → 3 packages clean
pnpm -r test                    → 120 / 120 passing
  - blu-core    : 51 / 51  (7 files)
  - blu-schema  : 11 / 11  (1 file)
  - blu-validate: 58 / 58  (8 files)
```

---

## 4. Sprint State

## Sprint 1 — Current Completed Work

**Status: Done**

### Goal
Deliver the Layer 1 Primitives: `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-validate`. Per `docs/blu/execution.md` §2.1.

### Completed
- Tore down the legacy 0.0.12 layout; refreshed all root tooling for v1.0.0-dev.
- Implemented `@kitsy/blu-core` — BluEvent envelope, EventClass, Durability, Origin, Authority, Causality, ULID event-id generator (monotonic-within-ms), Projection contract types.
- Implemented `@kitsy/blu-schema` — full type vocabulary for ApplicationConfiguration, ViewNode, DataSource, FormDefinition, Action, Condition, ComponentMeta, plus Value/Binding/Route/Theme/Registration helpers.
- Implemented `@kitsy/blu-validate` — `Result<T>` + `ErrorCollector` (with shared-sink child collectors) + validators for event, action, view-node, data-source, form, component-meta, application.
- All three packages compile under TS strict, build clean, and pass tests.

### Files touched
- Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `vitest.config.ts`, `branding.config.js`, `branding.config.d.ts`.
- `packages/blu-core/` — `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, 9 source files + 7 test files.
- `packages/blu-schema/` — `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, 12 source files + 1 test file.
- `packages/blu-validate/` — `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, 9 source files + 8 test files.

### Verification
- `pnpm -r build` → clean.
- `pnpm -r typecheck` → clean.
- `pnpm -r test` → 120 / 120 passing across all three packages.

### Remaining
- None for Sprint 1. Optional polish (later, not blocking Sprint 2):
  - Add `CHANGELOG.md` to each package (§4 quality rule).
  - Add ESLint config wiring (currently Prettier-only).

---

## Sprint 2 — Next Work

**Status: Ready to Start**

### Goal
Deliver `@kitsy/blu-bus` — the in-process event transport. `emit`, `subscribe`, middleware chain, filter resolution, auto-filling of envelope fields (`eventId`, `timestamp`, `sequence`, `causationId`, `correlationId`).

Per `docs/blu/execution.md` §2.1, "Sprint 2 — blu-bus".

### Reference docs
- `docs/blu/execution.md` §2.1 (Sprint 2 spec) and §3 (dependency rules).
- `docs/blu/specification.md` (envelope and classification semantics).
- `docs/blu/architecture.md` (where the bus sits relative to the slate).
- `packages/blu-core/src/envelope.ts` and `causality.ts` — already provide `applyEnvelopeDefaults()` and `propagateCausality()` that the bus must use.
- `packages/blu-validate/src/event.ts` — `validateEvent` to call from envelope-validation middleware.

### Tasks
1. Scaffold `packages/blu-bus/` with `package.json` (`@kitsy/blu-bus@1.0.0-dev.0`, ESM-only, `sideEffects: false`), `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`. Workspace deps: `@kitsy/blu-core` and `@kitsy/blu-validate`.
2. Implement `Bus` with:
   - `emit<TPayload>(event: PartialEvent<TPayload>): BluEvent<TPayload>` — applies envelope defaults, runs middleware, dispatches to subscribers, returns the finalized event.
   - `subscribe(filter, handler): Unsubscribe` — supports filter by exact type, namespace prefix (e.g. `cart:*`), scope path, and custom predicate.
   - `use(middleware)` — middleware chain with short-circuit, annotation, and observation (no payload mutation).
3. Implement causal context: when `emit` is called from inside a handler, the new event inherits `causationId = parentEvent.eventId` and `correlationId = parentEvent.correlationId` automatically. Use AsyncLocalStorage or an explicit synchronous context stack — pick the simpler one and document the choice.
4. Implement subscriber-error isolation — a thrown handler does not abort dispatch to other subscribers; surface the error via a system event (e.g. `system:bus:handler-error`).
5. Tests covering: emission shape, middleware order, short-circuit, filter semantics (type, prefix, scope, predicate), causal propagation across nested emits, subscriber isolation, sequence monotonicity per bus instance.

### Acceptance Criteria
Per `docs/blu/execution.md` Sprint 2 exit criteria:
- `emit` returns a finalized `BluEvent` with correct envelope fields, including causal inheritance from an in-flight handler context.
- Middleware can short-circuit, annotate, and observe without mutating payload.
- Subscription filters work by type, by namespace prefix, by scope path, and by custom predicate.
- Tests: emission, middleware order, filter semantics, causal propagation, error isolation.
- All Sprint 1 quality rules hold: TS strict, no `any` in public signatures, JSDoc on public functions, ≥80% coverage, ESLint warning-free (Prettier check passes).
- `pnpm -r build && pnpm -r typecheck && pnpm -r test` all pass; existing 120 tests remain green.

---

## Later Sprints

Listed for orientation only. **Do not implement ahead.**

- **Sprint 3 — blu-slate.** In-memory journal first, then IndexedDB. Projection engine. Authority enforcement. Snapshot + compaction. Replay.
- **Stage 1 gate:** harness can register projections, emit through the bus, observe state, persist, reload, and observe identical state. No React.
- **Sprint 4 — blu-wire.** Transport contract + LocalTransport + BroadcastChannelTransport.
- **Sprint 5 — blu-context (React binding).** `<BluProvider>`, hooks.
- **Sprint 6 — blu-devtools (MVP).** Journal timeline, causal trace, projection inspector, transport monitor.
- **Stage 2 gate.**
- **Sprint 7 — blu-view.** ViewNode renderer + ComponentRegistry.
- **Sprint 8 — schema actions, data sources, forms.**
- **Stage 3 gate.**
- **Sprint 9 — blu-shell + view library** (blu-grid, blu-ui, blu-icons, blu-style, blu-templates, blu-blocks).
- **Sprint 10 — blu-route + blu-cli + release hardening.**

---

## 5. Immediate Next-Agent Instructions

1. **Read first:** `docs/handover/OPUS_HANDOVER.md` (this file).
2. **Then read, in order:**
   - `docs/blu/foundation.md`
   - `docs/blu/architecture.md`
   - `docs/blu/specification.md` (focus: envelope fields, EventClass, Durability, causality, projection contract)
   - `docs/blu/execution.md` §2.1 (Sprint 2 spec) and §3 (dependency rules)
3. **Inspect the Sprint 1 deliverables before writing Sprint 2 code:**
   - `packages/blu-core/src/event.ts`, `event-id.ts`, `envelope.ts`, `causality.ts`, `index.ts`
   - `packages/blu-validate/src/event.ts`
4. **Implement Sprint 2 only.** Scaffold `packages/blu-bus/` per the task list in §4 above. Do not start Sprint 3 (slate).
5. **Files to edit:** new files under `packages/blu-bus/` only.
6. **Files NOT to touch:**
   - Anything under `packages/blu-core/`, `packages/blu-schema/`, `packages/blu-validate/` — Sprint 1 is sealed. Only edit if Sprint 2 surfaces a real bug; if it does, isolate the change and call it out in the next handover.
   - Root tooling files (`turbo.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `branding.config.js`) unless absolutely required.
   - Empty stub dirs (`packages/hooks`, `icons`, `integrate`, `templates`) — leave them alone.
   - Anything under `docs/` other than appending a status note to this handover at the end.
7. **Verification commands (must all pass):**
   ```
   pnpm install
   pnpm -r build
   pnpm -r typecheck
   pnpm -r test
   pnpm lint
   ```
   Existing 120 tests must remain green; Sprint 2 should add a substantive test suite for `blu-bus` (target ≥ 80% coverage on its public API).

---

## 6. Non-Negotiable Guardrails

- **Do not redesign the architecture.** The 4-stage / 10-sprint plan in `docs/blu/execution.md` is canonical.
- **Do not refactor unrelated code.** Sprint 2 touches `packages/blu-bus/` only (plus optional re-export stubs the task explicitly calls for).
- **Do not introduce backend integration before the planned sprint.** No HTTP, no WebSocket, no SSE in Sprint 2. Phase one ships only `LocalTransport` and `BroadcastChannelTransport` (Sprint 4).
- **Do not add a slate, projection engine, or React binding.** Those are Sprints 3–5. The bus must be usable standalone and not import a slate.
- **Preserve dependency direction.** `blu-bus` may import `blu-core` and `blu-validate` only. It must NOT import `blu-slate` (which doesn't exist yet anyway), `blu-context`, React, or anything from the view layer.
- **Preserve the BluEvent envelope contract.** Use `applyEnvelopeDefaults()` from `blu-core` rather than re-implementing field assignment. Use `propagateCausality()` for `causationId` / `correlationId` inheritance.
- **Preserve the `Result<T>` non-throwing contract.** Bus middleware that runs envelope validation must call `validateEvent()` and surface errors via a system event or a designated dead-letter path — not by throwing.
- **Keep the workspace glob `packages/blu-*`.** Any new package must follow the `blu-` prefix.
- **Keep `ESM-only`, `sideEffects: false`, TypeScript strict, no `any` in public signatures.**
- **Do not create CLAUDE.md or README files for packages** unless explicitly requested. Source-of-truth docs live under `docs/`.
- **Do not modify Sprint 1 packages** unless a bug forces it. If you must, document the change here in §3 before continuing Sprint 2.

---

## 7. Open Questions

| Question | Current leaning | Needed before |
|---|---|---|
| Causal context: AsyncLocalStorage vs. synchronous explicit stack? | Synchronous explicit stack — simpler, no Node-runtime dependency, fits the in-process bus. | Sprint 2 implementation start. |
| Where does the `sequence` field get its monotonic value — the bus or the slate? | Bus assigns a per-instance monotonic counter; slate may overwrite when persisting. The Sprint 1 placeholder is `-1`. | Sprint 2 emit implementation. |
| Should subscriber errors be re-emitted as a `system:bus:handler-error` event, or just logged via a configurable error sink? | Emit as a system event with `class: "system"`, `durability: "ephemeral"` — keeps the contract observable in devtools. | Sprint 2 error-isolation tests. |
| Filter syntax for namespace prefix — `cart:*` glob or first-segment match? | `cart:*` glob with single-trailing wildcard for v1; predicate filter handles the rest. | Sprint 2 filter implementation. |
| ESLint config — adopt now or after Sprint 3? | After Sprint 3 (Stage 1 gate). Prettier check is enough for Sprint 2. | Stage 1 gate. |
| Per-package `CHANGELOG.md`? | Add at first publish, not now. | First alpha publish. |

---

## 8. Ready Prompt for Next Agent

Copy-paste prompt for Sonnet / OpenAI Codex:

---

> You are continuing work on the Blu framework (event-first, schema-driven UI). A previous Opus session completed Sprint 1 and produced a handover.
>
> **Step 1 — Read these in order, no skipping:**
> 1. `docs/handover/OPUS_HANDOVER.md` (full file)
> 2. `docs/blu/foundation.md`
> 3. `docs/blu/architecture.md`
> 4. `docs/blu/specification.md` (focus on the envelope, EventClass, Durability, causality, projection contract)
> 5. `docs/blu/execution.md` §2.1 (Sprint 2 spec) and §3 (dependency rules)
> 6. `packages/blu-core/src/event.ts`, `event-id.ts`, `envelope.ts`, `causality.ts`, `index.ts`
> 7. `packages/blu-validate/src/event.ts`
>
> **Step 2 — Scope:** Implement **Sprint 2 only** — `@kitsy/blu-bus`. The full task list and acceptance criteria are in `docs/handover/OPUS_HANDOVER.md` §4 "Sprint 2 — Next Work".
>
> **Step 3 — Guardrails (do not violate):**
> - Do not redesign the architecture. Do not refactor unrelated code.
> - Do not modify `packages/blu-core/`, `packages/blu-schema/`, or `packages/blu-validate/` unless you find a real bug — and if you do, document it in the handover before proceeding.
> - `blu-bus` may import only `@kitsy/blu-core` and `@kitsy/blu-validate`. No React, no slate, no transports.
> - Use `applyEnvelopeDefaults()` and `propagateCausality()` from `blu-core`. Do not re-implement them.
> - Validators never throw. The bus uses `Result<T>` and surfaces errors via a `system:bus:handler-error` event.
> - TypeScript strict, ESM-only, `sideEffects: false`, no `any` in public signatures, JSDoc on public functions, ≥80% coverage, vitest only.
> - Workspace package name pattern is `@kitsy/blu-*`, version `1.0.0-dev.0`.
> - Do not create CLAUDE.md or README files unless explicitly asked.
>
> **Step 4 — Files you will create:** new files under `packages/blu-bus/` only (`package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `src/*.ts`, `src/*.test.ts`).
>
> **Step 5 — Verification (must all pass before you report done):**
> ```
> pnpm install
> pnpm -r build
> pnpm -r typecheck
> pnpm -r test     # existing 120 tests must remain green; Sprint 2 must add coverage
> pnpm lint
> ```
>
> **Step 6 — Update the handover.** When Sprint 2 is complete, edit `docs/handover/OPUS_HANDOVER.md`:
> - Move Sprint 2 from "Next Work" to "Current Completed Work" (mark as Done with file list and verification output).
> - Add Sprint 3 (`blu-slate`) as the new "Next Work" using the spec in `docs/blu/execution.md` §2.1.
> - Update §3 "Current Repo State" with the new package and refreshed test counts.
> - Resolve or update §7 "Open Questions" based on choices you made.
>
> Begin by reading the handover, then proceed.
