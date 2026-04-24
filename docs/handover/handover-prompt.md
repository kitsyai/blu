
**Sprint 1 status:** ✅ Done — `@kitsy/blu-core`, `@kitsy/blu-schema`, `@kitsy/blu-validate` all implemented, building clean, typechecking clean, with 120/120 tests passing (51 + 11 + 58).

**Sprint 2 status:** Ready to Start — scoped to `@kitsy/blu-bus` only. Spec, dependency rules, tasks, acceptance criteria, and guardrails are all captured in the handover.

**Next prompt to give Codex/Sonnet (copy-paste):**

You are continuing work on the Blu framework (event-first, schema-driven UI). A previous Opus session completed Sprint 1 and produced a handover.

**Step 1 — Read these in order, no skipping:**
1. `docs/handover/OPUS_HANDOVER.md` (full file)
2. `docs/blu/foundation.md`
3. `docs/blu/architecture.md`
4. `docs/blu/specification.md` (focus on the envelope, EventClass, Durability, causality, projection contract)
5. `docs/blu/execution.md` §2.1 (Sprint 2 spec) and §3 (dependency rules)
6. `packages/blu-core/src/event.ts`, `event-id.ts`, `envelope.ts`, `causality.ts`, `index.ts`
7. `packages/blu-validate/src/event.ts`

**Step 2 — Scope:** Implement **Sprint 2 only** — `@kitsy/blu-bus`. The full task list and acceptance criteria are in `docs/handover/OPUS_HANDOVER.md` §4 "Sprint 2 — Next Work".

**Step 3 — Guardrails (do not violate):**
- Do not redesign the architecture. Do not refactor unrelated code.
- Do not modify `packages/blu-core/`, `packages/blu-schema/`, or `packages/blu-validate/` unless you find a real bug — and if you do, document it in the handover before proceeding.
- `blu-bus` may import only `@kitsy/blu-core` and `@kitsy/blu-validate`. No React, no slate, no transports.
- Use `applyEnvelopeDefaults()` and `propagateCausality()` from `blu-core`. Do not re-implement them.
- Validators never throw. The bus uses `Result<T>` and surfaces errors via a `system:bus:handler-error` event.
- TypeScript strict, ESM-only, `sideEffects: false`, no `any` in public signatures, JSDoc on public functions, ≥80% coverage, vitest only.
- Workspace package name pattern is `@kitsy/blu-*`, version `1.0.0-dev.0`.
- Do not create CLAUDE.md or README files unless explicitly asked.

**Step 4 — Files you will create:** new files under `packages/blu-bus/` only (`package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `src/*.ts`, `src/*.test.ts`).

**Step 5 — Verification (must all pass before you report done):**
```
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test     # existing 120 tests must remain green; Sprint 2 must add coverage
pnpm lint
```

**Step 6 — Update the handover.** When Sprint 2 is complete, edit `docs/handover/OPUS_HANDOVER.md`:
- Move Sprint 2 from "Next Work" to "Current Completed Work" (mark as Done with file list and verification output).
- Add Sprint 3 (`blu-slate`) as the new "Next Work" using the spec in `docs/blu/execution.md` §2.1.
- Update §3 "Current Repo State" with the new package and refreshed test counts.
- Resolve or update §7 "Open Questions" based on choices you made.

Begin by reading the handover, then proceed.