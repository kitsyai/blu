# Kitsy — Shared Governance

**Status:** Canonical
**Scope:** Cross-track rules that apply to every track and every agent. Each track's execution document adds track-specific rules on top of these.

---

## 1. The one rule

> **Build only what is in the active scope of your track's current sprint. If it is not in the sprint, do not build it — even if it is described in a spec document.**

---

## 2. Track status

| Track | Name             | Phase | Status                              |
|-------|------------------|-------|-------------------------------------|
| A     | Blu Framework    | 1     | **Active**                          |
| B     | Platform Shell   | 1     | **Active**                          |
| C     | Kitsy Server     | 2     | **Active** (starts after Blu gate)  |
| D     | Coop Module      | 3     | Planned                             |
| E1    | Kitsy Studio     | 4     | Specified, not active               |
| E2    | Kitsy Mind       | 4     | Specified, not active               |

Rule: if a track's status is "Specified, not active," work does not begin on it. Wait for the start condition in the relevant execution document.

---

## 3. Phase gates

No track advances to the next phase until every gate criterion in its execution document is met and verified by Prashant.

---

## 4. Cross-track dependency protocol

When a track depends on another track's output:

1. Check whether the dependency package is published on the internal registry.
2. If yes, import it and proceed.
3. If no, stop the sprint, document the blocker, and notify Prashant.
4. Do not stub or mock another track's package as a workaround. Stubs drift.
5. Do not copy code from another track's package into yours.

---

## 5. Shared code quality

Every track, every package, every commit:

- TypeScript strict mode. No `any`. Use `unknown` with type guards.
- JSDoc on every public function.
- Public API test coverage above 80 percent.
- ESLint: zero warnings on commit.
- A CHANGELOG.md per package.

---

## 6. Event and bus governance

Blu defines a single event envelope (see `docs/blu/specification.md §1`). Every track that emits events conforms to it.

Naming is fixed:

```
{module}:{entity}:{action}          lowercase, colon-separated
Facts are past tense               (cart:item:added)
Intents are present tense          (cart:item:add-requested)
Each module owns its namespace exclusively.
```

Class and durability are declared at emission. Cross-module subscription requires an event whose scope declares cross-module visibility at the emitter.

What belongs on the bus: state changes, projection inputs, cross-module events, AI requests, sync events.

What belongs on REST or other APIs: billing, domains, email, CDN deploys, asset uploads, database migrations. These are out-of-band from the event model and stay that way.

---

## 7. Document hierarchy

When documents conflict, resolution order is:

1. **This governance document.**
2. **`docs/blu/foundation.md`** — the canonical principles for the Blu framework, which set the shape of every downstream track.
3. **`docs/blu/architecture.md`** — the layered architecture and package map.
4. **`docs/blu/specification.md`** — the contracts.
5. **`docs/blu/shell.md`** — shell taxonomy and conformance.
6. **Track execution documents** (`docs/blu/execution.md`, `docs/impl/kitsy-*-execution-pack.md`).
7. **Track specifications** (`docs/specs/blu-component-specifications.md`, `docs/specs/kitsy-*-implementation-spec.md`).
8. **`docs/reference/kitsy-platform-architecture.md`** — platform-wide concerns downstream of the framework.

A document lower on this list may elaborate but cannot override a document higher on it. If an elaboration appears to contradict, the higher document wins and the lower document is updated to align.

---

## 8. Decision authority

| Decision                             | Who                 | Process                                       |
|--------------------------------------|---------------------|-----------------------------------------------|
| Architecture change                  | Prashant            | Updates `docs/blu/architecture.md`, notifies tracks |
| Sprint scope change                  | Prashant            | Updates track execution document              |
| Bug fix in own track                 | Track agent         | PR with tests, Prashant reviews               |
| New dependency                       | Prashant approves   | Agent proposes with justification             |
| Schema or contract change            | Prashant            | Updates `docs/blu/specification.md`; tracks pick up |
| Phase-gate advancement               | Prashant            | Verifies gate criteria                        |
| Cross-track coordination             | Prashant            | Mediates between tracks                       |
| Event taxonomy change                | Prashant            | Updates `docs/blu/specification.md`           |
| New shell primary, presenter, overlay| Prashant            | Updates `docs/blu/shell.md`                   |

---

## 9. Scope change protocol

If, during a sprint, an agent discovers:

- The spec is insufficient: **stop**, document the gap, propose a resolution, wait for Prashant.
- The spec is contradictory: **stop**, document both sides, wait for Prashant.
- The spec is underspecified for the task: **stop**, write a clarifying question, wait for Prashant. Do not invent.
- The sprint requires something from another track that is not yet shipped: **stop**, document the dependency, wait for Prashant.
- The agent wants to add something not in the sprint: **do not.** Finish what is scoped first.

---

## 10. What an agent receives at sprint start

When a track agent starts a sprint, it receives:

1. This governance document.
2. The track's execution document.
3. The relevant sections of the specification, named explicitly in the sprint prompt.
4. The previous sprint's handoff artifact, if not the first sprint.

That is the entire context. Agents working on the Blu framework track do not read the Studio, Mind, or Server specs. Agents working on Server do not read Studio or Mind.

This is intentional. Limiting context prevents drift.

---

## 11. Version zero

Blu is at version zero. There is no deployed application constrained by earlier contracts. Decisions are made on merits, not on compatibility preservation. When a decision in this document or any canonical document supersedes an older note, the older note is replaced, not appended to.
