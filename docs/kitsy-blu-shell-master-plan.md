# `@kitsy/blu` — Shell System Promotion Master Plan

**Context.** `@kitsy/blu` is the schema-driven framework powering `pkvsinha/webapp` (prashantsinha.com), `heypkv/webapp` (heypkv.ai), and eventually `kitsy/webapp`. All three follow the same pattern: pnpm monorepo, Blu handling initialization and routing, individual apps as feature gates. Shell composition, lazy loading, and view manifests are currently implemented ad-hoc in each repo.

**This document plans the promotion** of the shell system — once hardened in `heypkv/webapp` (see companion: `heypkv-shell-implementation.md`) — into `@kitsy/blu` as a first-class capability, usable by all three sites.

**Strategic principle: specific → generic.** The heypkv implementation is the reference. Promotion means extracting what is site-agnostic into Blu, leaving site-specific shells (if any emerge) behind in the site package. Nothing is promoted speculatively.

---

## 1. Promotion criteria — when is heypkv/shell ready?

Promotion begins only when all of the following are true:

1. **All three heypkv sites** (`main`, `food`, `travel`) consume `@heypkv/shell` in production, with zero inline shell code remaining in the sites.
2. **Every v1 shell** (7 primaries, 3 presenters, 5 overlays) has shipped and been used by at least one view.
3. **Composition rules hold** across at least 30 views spanning all three sites. The dev-mode composition validator has caught and prevented at least one illegal stack during development.
4. **No shell API has been breaking-changed** for 2+ weeks of daily use. This is the stability signal — if the contract is still shifting, it's not ready to become a framework.
5. **Prashant has reviewed the full shell package** and confirms the API surface is what he'd have designed from scratch, not just what accreted.

If any criterion fails, fix in heypkv first. Promoting early forces Blu consumers (prashantsinha.com, kitsy.ai) to eat heypkv's churn.

---

## 2. What gets promoted vs what stays

### 2.1 Promoted to `@kitsy/blu` (or `@kitsy/blu-shell` as a sibling package)

| Layer                              | Rationale                                                      |
|------------------------------------|----------------------------------------------------------------|
| Core types (`ShellAPI`, `ShellKind`, `ShellCategory`, `ShellComponent`, `ShellHOC`) | Pure contract, site-agnostic. |
| `createShellContext`, `registerShellContext`, `useShellByKind`, `useShell` | Core mechanism.                |
| `createEventBus`                   | Generic utility.                                               |
| `asLazy`, `compose` HOCs           | Generic HOCs.                                                  |
| Composition validator              | Rules are taxonomy-level, not site-level.                      |
| All primary shells (Blank, AppBar, Nav, Game, Canvas, Doc, Wizard) | Cover standard UI archetypes. |
| All presenters (Sheet, Modal, Drawer) | Universal container patterns.                               |
| Generic overlays (Beta, Maintenance, Offline) | Apply to any product.                                 |

### 2.2 Stays in site packages

| Layer                              | Rationale                                                      |
|------------------------------------|----------------------------------------------------------------|
| `SubscriptionShell`                | Subscription model is heypkv-specific; logic bound to heypkv billing. Blu can ship a `<BannerShell>` primitive that sites wrap for subscription/trial/custom nags. |
| `ImpersonationShell`               | Tied to heypkv auth model. Same pattern: Blu ships a generic banner shell; sites specialize. |
| Theme tokens                       | Sites own their design system; Blu shell consumes tokens via CSS variables. |
| Site-specific view maps            | Obviously per-site.                                            |
| App components                     | Obviously per-site.                                            |

### 2.3 Generalization: `BannerShell` as a base overlay

During promotion, `BetaShell`, `MaintenanceShell`, `OfflineShell` are re-implemented as thin wrappers over a single `BannerShell` primitive in Blu:

```ts
<BannerShell
  visible={...}
  variant="info" | "warn" | "error"
  icon={...}
  title="..."
  action={...}
  dismissible
/>
```

Sites get `BannerShell` as a building block. Built-in overlays (Beta, Maintenance, Offline) use it. Sites that need product-specific overlays (Subscription, Impersonation, Trial, Usage) compose their own in their site package, same pattern.

This is a generalization discovered during heypkv usage — it's exactly the kind of refactor that promotion should surface, not invent.

---

## 3. Package structure inside Blu

Decision point: **single package (`@kitsy/blu`) or split (`@kitsy/blu` + `@kitsy/blu-shell`)?**

Recommendation: **split**. Reasons:

- Blu's current scope (initialization, routing, schema-driven UI) is orthogonal to shells. Bundling couples them unnecessarily.
- Sites that want Blu's routing but not its shells (or vice versa) can pick.
- Shell iteration shouldn't force a Blu core release.
- Matches the split Blu already has (`@kitsy/blu`, `@kitsy/blu-*` subpackages, per existing pattern).

Proposed:

```
kitsy/ (monorepo)
├── packages/
│   ├── blu/                    # core (init, routing, view manifest)
│   ├── blu-shell/              # NEW — promoted from heypkv/shell
│   │   ├── src/
│   │   │   ├── core/
│   │   │   ├── hoc/
│   │   │   ├── primary/
│   │   │   ├── presenter/
│   │   │   ├── overlay/
│   │   │   │   └── BannerShell/  # new base, implemented during promotion
│   │   │   └── dev/
│   │   └── README.md
│   ├── blu-state/              # (if/when state externalization happens)
│   └── blu-theme-adapter/      # optional: bridges site theme tokens → shell
```

`@kitsy/blu-shell` has `@kitsy/blu` as a peer dependency (for view-manifest types) but not a hard dependency. Shells should be usable without Blu's router in principle — it's valuable optionality.

---

## 4. Integration with Blu's existing systems

### 4.1 View manifest

Blu already has a view manifest concept; today each site implements it slightly differently. Promotion standardizes the entry shape:

```ts
// @kitsy/blu core
export interface ViewEntry<P = any> {
  id: string                           // slug
  view: ComponentType<P>               // fully-shelled, possibly lazy
  meta?: {
    title?: string
    icon?: string
    permissions?: string[]
    // ... Blu-defined metadata
  }
}
```

Sites construct entries:

```ts
import { asLazy, withAppBarShell } from '@kitsy/blu-shell'
import type { ViewEntry } from '@kitsy/blu'

const views: ViewEntry[] = [
  { id: 'profile', view: asLazy(() => import('./app/profile').then(m => ({ default: withAppBarShell(m.ProfilePage, { title: 'Profile' }) }))) },
]
```

This is the shape Prashant already wants. Promotion locks it in.

### 4.2 Routing

Blu's router consumes the manifest and renders by slug. No router changes needed — the shell system is orthogonal. The router doesn't know about shells.

### 4.3 Blu state-as-data (future)

When Blu's state layer stabilizes, shell state externalization becomes an option. The hook API stays identical; the reducer-backed implementation is swapped for a Blu-state-backed one behind the shell boundary. This is a non-breaking refactor if the initial implementation keeps `useReducer` inside the shell and exposes **only** the `ShellAPI` to consumers.

No consumer code changes. This is the payoff for the discipline in the heypkv POC.

### 4.4 Blu schema-driven UI (the bigger vision)

Shells today are hand-written components. Long-term, they could be schema-described in Blu's DSL (same as any other Blu-driven view). This is explicitly **out of scope** for promotion. First Blu ships hand-written shells that work; schema-driven shells are a future exploration and require Blu's schema system to mature further.

When it happens, the migration path is: keep the component API identical, swap implementation internals. The `withGameShell(App, config)` HOC call doesn't change.

---

## 5. Cross-site adoption sequence

Once `@kitsy/blu-shell` is published, migrate sites in this order:

### 5.1 `heypkv/webapp` (first — already using `@heypkv/shell`)

- Swap `@heypkv/shell` imports for `@kitsy/blu-shell`.
- Move Subscription/Impersonation shells into `heypkv/webapp/packages/site-shells/` (new site-local package) using `BannerShell`.
- Delete `heypkv/webapp/packages/shell/` — its contents are now either in Blu or in `site-shells`.

Low risk: API is identical.

### 5.2 `pkvsinha/webapp` (second — adopts fresh)

- Audit current inline shell code in pkvsinha/webapp. Identify which primaries/presenters/overlays it uses today.
- Replace inline code with `@kitsy/blu-shell` imports.
- Migrate view map to canonical shape.

Medium risk: first time Blu shells meet a different site's existing code. This is the real test of generalization. If pkvsinha needs a shell that doesn't exist, **that's signal**: either extend config, or add to the taxonomy with Prashant's approval.

### 5.3 `kitsy/webapp` (third — greenfield)

Built on Blu shells from day one. This is the ideal path and validates that a new site can start from the framework rather than drift into ad-hoc code.

---

## 6. Versioning and stability policy

`@kitsy/blu-shell` follows semver with these guarantees:

- **Patch releases**: bug fixes, internal refactors, new shell config options (additive).
- **Minor releases**: new shells, new overlays, new HOCs, new hooks. Never break existing APIs.
- **Major releases**: breaking changes. Only with Prashant's explicit sign-off. Expected cadence: rare.

Specific non-breaking guarantees once 1.0:

- `ShellAPI` shape (state/actions/events triad) is frozen.
- Every existing shell's `config`, `state`, `actions`, `events` types are additive-only in minor releases.
- HOC signatures (`withXxxShell(Component, config?)`) are stable.
- Hook names and return types are stable.

The reason this matters: apps across 3+ sites consume these hooks. A breaking change means coordinated updates across every site and every app. This is the exact lock-in that demands stability.

---

## 7. Documentation requirements

Before the first `@kitsy/blu-shell` tag, these must exist:

1. **README** with the one-paragraph mental model (overlays → presenter → primary → app) and a single end-to-end example.
2. **Shell catalog page** — one row per shell, with: kind, category, use case, config shape, one-line example, link to detailed page.
3. **Per-shell detail page** — config reference, state/actions/events reference, at least two usage examples, composition notes ("commonly wrapped by SheetShell" etc.), when-not-to-use callout.
4. **Composition guide** — the rules, why they exist, three worked examples, and the full matrix of legal/illegal combinations.
5. **Migration guide from ad-hoc layouts** — for sites that have inline layout code today (prashantsinha.com, kitsy.ai). Step-by-step.
6. **Contract doc** — what apps may assume, what apps must not do (import shell components, route high-frequency inputs through state, etc.). Referenced by ESLint rules.

Docs live in the existing Kitsy Starlight docs (per the CNOS docs architecture decision). Shell docs get a top-level section in the Blu docs tree.

---

## 8. Tooling and enforcement

Promoted from heypkv, refined for framework scale:

### 8.1 ESLint plugin (`@kitsy/eslint-plugin-blu-shell`)

Ships with Blu-shell. Rules:

- `no-shell-components-in-apps` — app files (configured path pattern) cannot import shell components, only hooks.
- `no-shell-state-for-high-frequency` — flags `useEffect(() => shell.state.controls...)` patterns; suggests event-bus subscription.
- `one-primary-per-stack` — static analysis catches `withGameShell(withAppBarShell(...))` at lint time, not just runtime.
- `overlays-outside-primary` — flags `withGameShell(withBetaShell(...))` (wrong order).

### 8.2 Composition validator (runtime, dev-only)

Ships in Blu-shell. Identical behavior to heypkv's POC. Tree-shaken in production.

### 8.3 Shell conformance test kit

A published test helper — `@kitsy/blu-shell/testing` — that any shell (including site-local shells built on BannerShell) can use to verify contract compliance:

```ts
import { assertShellContract } from '@kitsy/blu-shell/testing'

assertShellContract(MyCustomShell, {
  kind: 'my-custom',
  category: 'overlay',
  requiredActions: ['dismiss'],
  requiredEvents: [],
})
```

This prevents site-specific shells from drifting from the framework's assumptions.

### 8.4 Storybook (or equivalent)

Per-shell playground published with docs. Each shell has:
- Isolated render with sample content.
- Config playground (adjust props live).
- Composition demos (Sheet + Game, Beta + AppBar, etc.).

---

## 9. Migration checklist per site

Reusable as each site adopts Blu-shell:

- [ ] Audit current inline shell/layout code. Categorize by the Blu taxonomy.
- [ ] Map each current layout to a Blu shell + config.
- [ ] Identify site-specific shells needed. Build them on `BannerShell` or flag for framework extension.
- [ ] Add `@kitsy/blu-shell` dependency, add ESLint plugin.
- [ ] Migrate view manifest to canonical `ViewEntry` shape.
- [ ] Migrate one view end-to-end. Verify visual parity.
- [ ] Migrate remaining views.
- [ ] Delete old layout code.
- [ ] Run ESLint — zero violations in app code.
- [ ] Run composition validator tests — zero illegal stacks.
- [ ] Bundle-size audit — shell code should tree-shake; unused shells should not ship.

---

## 10. Risks and mitigations

| Risk                                                         | Mitigation                                                    |
|--------------------------------------------------------------|---------------------------------------------------------------|
| heypkv's shells turn out to be heypkv-shaped, not generic.   | Strict Section 1 gate: 3 sites use it before promotion. If they can't, it's not ready. |
| Blu consumers want different shell behavior per site.        | All variation goes through config. New kinds are rare and reviewed. Site-local shells use `BannerShell`. |
| `useReducer` inside shells becomes a perf bottleneck.        | State externalization to Blu-state is planned, non-breaking behind the hook API. |
| Shell package bloat as taxonomy grows.                       | Each shell is its own subpath export. Tree-shaking verified in bundle audit. Site imports only what it uses. |
| Framework-breaking changes forced by a single site's needs.  | Section 6 versioning policy. Major releases are rare. Site-specific pressure goes into site-local shells, not framework changes. |
| Agents invent ad-hoc shells instead of configuring existing ones. | Acceptance gates + ESLint rule + Prashant review on any new `ShellKind` PR. |

---

## 11. Success signals (12 months out)

Promotion is successful if, a year after first `@kitsy/blu-shell` release:

1. All three sites (heypkv, prashantsinha, kitsy) are in production on Blu-shell.
2. New apps ship with zero custom shell code — they pick existing shells and compose.
3. A new site can be scaffolded in a day: Blu router + Blu-shell + a view manifest.
4. The v1 taxonomy has proven sufficient — at most 1–2 new primaries added since initial release, each with a clear rationale.
5. No major version bumps caused by API regret. Only additive changes.
6. Third-party/external developers (if that becomes a thing for Kitsy) can build apps without ever reading Blu-shell's internals — the hook API is enough.

If any of these don't hold, the retrospective asks whether the POC → framework gap was too aggressive, or whether the taxonomy needs revisiting.

---

## 12. Explicitly deferred

These are *not* part of promotion. Each is a separate future proposal:

- Manifest-driven (runtime) app registration.
- Shell middleware / interceptors / lifecycle plugins.
- Schema-driven shells via Blu DSL.
- Cross-shell action orchestration (WizardShell closing SheetShell, etc.).
- Server-side rendering support (unless a Blu consumer needs it, at which point it's scoped separately).
- Theming marketplace / third-party shells.
- AI-generated shells.

Each would follow the same discipline: prove in a concrete site first, promote only when it generalizes.
