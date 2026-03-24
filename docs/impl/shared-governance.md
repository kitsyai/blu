# Kitsy — Shared Governance Rules

**Version:** 1.0  
**Date:** 2026-03-22  
**Status:** Active — all tracks, all agents must follow this document  
**Scope:** Cross-track rules that apply universally. Each track's execution pack includes track-specific rules in addition to these.

---

## 1. The One Rule

> **Build only what is in the active scope of your track's current phase. If it's not in your sprint plan, don't build it — even if it's described in a spec document.**

---

## 2. Track Status

| Track | Name | Phase | Status |
|-------|------|-------|--------|
| A | Blu Framework | 1 | **Active** |
| B | Platform Shell | 1 | **Active** |
| C | Kitsy Server | 2 | **Active** (starts Week 3) |
| D | Coop Module | 3 | Planned |
| E1 | Studio | 4 | Specified, not active |
| E2 | Mind | 4 | Specified, not active |

**Rule:** If your track status is "Specified, not active" — do not begin work. Wait for the start condition in your execution pack.

---

## 3. Phase Gates

No track advances to the next phase until the gate criteria in its execution pack are ALL met and verified by Prashant.

---

## 4. Cross-Track Dependency Protocol

When your track depends on another track's output:

1. Check if the dependency package is published on npm (or available in the monorepo)
2. If YES → import it and proceed
3. If NO → stop the sprint, document the blocker, notify Prashant
4. Do NOT stub or mock another track's package as a workaround (it will drift)
5. Do NOT copy code from another track's package into yours

---

## 5. Shared Code Quality

```
ALL code, ALL tracks:
  - TypeScript strict mode
  - No `any` types (use `unknown` + type guards)
  - JSDoc on public functions
  - >80% test coverage on public API
  - ESLint zero warnings
  - CHANGELOG.md per package
```

---

## 6. Bus Command Governance

```
Naming:     {module}:{entity}:{action}  (lowercase, colon-separated)
Events:     Past tense (blu:site:published, crm:deal:won)
Commands:   Present tense (ai:generate-site, sync:config:propose)
Namespaces: Each module owns its namespace exclusively
Cross-module: Only subscribe to events with visibility: "cross-module"

What goes ON the bus:  state sync, config sync, real-time UI, AI requests, cross-module events
What uses REST/API:    billing, domains, email, CDN deploy, asset upload, DB migrations
```

---

## 7. Document Hierarchy

When documents conflict, resolution order:

```
1. Shared Governance (this document)
2. Track Execution Pack (track-specific rules)
3. Implementation Roadmap (if still referenced)
4. Kitsy Platform Architecture
5. Blu SSOT
6. Individual spec documents (Server, Components, Studio, Mind, Hosting)
```

---

## 8. Decision Authority

| Decision | Who | Process |
|----------|-----|---------|
| Architecture change | Prashant | Updates spec doc, notifies all tracks |
| Sprint scope change | Prashant | Updates execution pack |
| Bug fix in own track | Agent | PR + tests, Prashant reviews |
| New dependency | Prashant approves | Agent proposes with justification |
| Schema/contract change | Prashant | Updates `@kitsy/blu-types`, all agents pick up |
| Phase gate advancement | Prashant | Verifies gate criteria |
| Cross-track coordination | Prashant | Mediates between track agents |

---

## 9. Scope Change Protocol

If during a sprint, you discover:
- The spec is insufficient → **STOP**, document the gap, propose a resolution, wait for Prashant
- The spec is contradictory → **STOP**, document both sides, wait for Prashant
- You need something from another track → **STOP**, document the dependency, wait for Prashant
- You want to add something not in the sprint → **DON'T**, finish what's scoped first

---

## 10. What Each Agent Receives

When starting a sprint, an agent gets:

1. **This shared governance document** (always)
2. **Their track's execution pack** (always)
3. **The relevant spec sections** (listed in the sprint prompt)
4. **Previous sprint's handoff artifact** (if not the first sprint)

That's it. No other documents. Agents working on Blu Track A should NOT read the Mind spec, Studio spec, or Platform Architecture. Agents working on Server Track C should NOT read the Studio or Mind specs.

This is intentional. Limiting context prevents drift.
