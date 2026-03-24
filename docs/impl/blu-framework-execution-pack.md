# Blu Framework — Execution Pack

**Track:** A (Blu Framework)  
**Phase:** 1 (Active NOW)  
**Owner:** Prashant (architect) + Codex agents  
**Repo:** `github.com/kitsy-ai/blu` (monorepo, pnpm workspace)  
**Spec Documents:** Blu SSOT, Component Specifications  
**Status:** This is the first track to ship. Everything else depends on it.

---

## Scope Rule

> **This track builds ONLY the open-source Blu framework packages. No platform shell, no server, no Studio, no Mind, no Coop.**
>
> If a task involves authentication, tenancy, billing, visual editing, AI generation, or server-side logic — it is OUT OF SCOPE for this track.

---

## 1. Sprint Plan

### Sprint A1 — Package Rebrand (Weeks 1-2)

**Objective:** Rename all packages from `@pkvsinha/react-*` to `@kitsy/blu-*`.

| # | Task |
|---|------|
| 1 | Register `@kitsy` org on npm |
| 2 | Update every `package.json`: name, repository, homepage, bugs |
| 3 | Update all internal import paths across all 11 packages |
| 4 | Update UMD bundle: expose `window.Blu` instead of `window.ReactApp` |
| 5 | Update URL auto-render to use `window.Blu.render` |
| 6 | Build and verify the standalone UMD bundle under new name |
| 7 | Publish all packages to npm under `@kitsy` scope |
| 8 | Create deprecated `@pkvsinha/react-*` packages that re-export from `@kitsy/blu-*` |
| 9 | Update README files with new package names |

**Package mapping:**

| Old | New |
|-----|-----|
| `@pkvsinha/react-app` | `@kitsy/blu-shell` |
| `@pkvsinha/react-base` | `@kitsy/blu-core` |
| `@pkvsinha/react-components` | `@kitsy/blu-ui` |
| `@pkvsinha/react-integrate` | `@kitsy/blu-bus` |
| `@pkvsinha/react-navigate` | `@kitsy/blu-route` |
| `@pkvsinha/react-theme` | `@kitsy/blu-style` |
| `@pkvsinha/react-hooks` | `@kitsy/blu-context` |
| `@pkvsinha/react-layout` | `@kitsy/blu-grid` |
| `@pkvsinha/react-icons` | `@kitsy/blu-icons` |
| `@pkvsinha/react-widgets` | `@kitsy/blu-blocks` |
| `@pkvsinha/react-templates` | `@kitsy/blu-templates` |

**Exit criteria:**
- [ ] All 11 packages published under `@kitsy/blu-*`
- [ ] `npm install @kitsy/blu-shell` works
- [ ] `window.Blu.render(config)` works via CDN script tag
- [ ] All existing tests pass with new package names
- [ ] Deprecated aliases published for `@pkvsinha/react-*`

**DO NOT:** Change any functionality. Only names and imports.

---

### Sprint A2 — Schema Foundation (Weeks 1-2, parallel with A1)

**Objective:** Create `@kitsy/blu-types` with TypeScript types and JSON Schema for all core contracts.

| # | Task |
|---|------|
| 1 | Create new package `@kitsy/blu-types` in the monorepo |
| 2 | Define TypeScript interfaces (from SSOT §6): ApplicationConfiguration, ViewNode, ViewDefinition, DataSource, DataSourceAdapter, DataResult, MutationResult, ViewNodeDataBinding, Action (all 6 union members: Navigate, Bus, Mutate, State, Form, Composite), FormViewNode, FormField, FormFieldOption, Command, CommandMeta, Transport, ComponentMeta, SlotDefinition, ThemeTokens, RenderOptions, AppInstance |
| 3 | Add `$schema` and `$version` fields to ApplicationConfiguration |
| 4 | Generate JSON Schema from TypeScript types |
| 5 | Create 3 example configs that validate against the schema: (a) simple landing page with hero + features + footer, (b) multi-page site with data bindings and repeat, (c) form-based contact page with actions |
| 6 | Add CI check: example configs validate against JSON Schema |
| 7 | Publish `@kitsy/blu-types` to npm |

**Exit criteria:**
- [ ] `@kitsy/blu-types` published with all interfaces from SSOT §6
- [ ] JSON Schema generated and included in package
- [ ] 3 example configs pass validation in CI
- [ ] Package has zero dependencies
- [ ] Package works in Node.js and browser

**DO NOT:** Implement any runtime logic. This is types only.

---

### Sprint A3 — React Boundary Split (Weeks 2-3)

**Objective:** Split `@kitsy/blu-shell` into `/core` (universal, DOM-free) and `/react` (React-specific).

| # | Task |
|---|------|
| 1 | Identify all React-independent code in blu-shell: config compilation, ViewNode resolution, action resolution, plugin mounting |
| 2 | Move React-independent code to `src/core/` |
| 3 | Keep React-specific code in `src/react/`: render(), renderToStringSSR(), BluProvider, React hooks |
| 4 | Update package.json exports: `"."` → react, `"./core"` → core, `"./react"` → react |
| 5 | Add CI check: `grep -r "react" src/core/` → fail build if found |
| 6 | Verify existing imports still work (default import = React, no breaking change) |

**Exit criteria:**
- [ ] `import { compileConfig } from "@kitsy/blu-shell/core"` works without React installed
- [ ] `import { render } from "@kitsy/blu-shell"` still works (backward compatible)
- [ ] CI verifies zero React imports in `/core`
- [ ] All existing tests pass

**DO NOT:** Build a non-React renderer. Only split the boundary.

---

### Sprint A4 — ViewNode Parallel Path (Weeks 2-3, parallel with A3)

**Objective:** Add ViewNode children support to ViewDefinition alongside existing ReactNode.

**Ref:** SSOT §6.2 (ViewNode), §6.3 (ViewDefinition)

| # | Task |
|---|------|
| 1 | Extend ViewDefinition to accept `children: ViewNode[]` alongside existing `view: ReactNode` |
| 2 | In config compiler: if `children` is present, resolve each ViewNode via ComponentRegistry to React elements |
| 3 | Resolution: `componentUrn` → registry lookup → `React.createElement(component, props, resolvedChildren)` |
| 4 | Support nested ViewNode trees (recursive resolution) |
| 5 | Support `slot` field on child ViewNodes |
| 6 | If both `view` and `children` are present, `children` takes precedence |
| 7 | Add example config using ViewNode children to the test suite |

**Exit criteria:**
- [ ] A config with `children: [{ id: "text-1", componentUrn: "urn:blu:core:text", props: { content: "Hello" } }]` renders correctly
- [ ] Nested ViewNodes (parent → children → grandchildren) resolve correctly
- [ ] Existing configs using `view: ReactNode` still work unchanged

**DO NOT:** Remove ReactNode support. Both paths coexist.

---

### Sprint A5 — URL Rendering Hardening (Weeks 3-4)

**Objective:** Secure and harden the `?_render=base64` URL rendering path.

**Ref:** SSOT §4.3 (URL Rendering)

| # | Task |
|---|------|
| 1 | Update URL auto-render to use `window.Blu` namespace |
| 2 | Implement XSS sanitization on all string prop values from URL-loaded configs |
| 3 | When `_strict=1`: validate config against JSON Schema before rendering (import from `@kitsy/blu-types` schema) |
| 4 | Strip `$auth` field from URL-loaded configs (security: no auth tokens in URLs) |
| 5 | Add content-length guard: reject `_render` payloads > 50KB decoded |
| 6 | Add comprehensive error handling: malformed base64, invalid JSON, schema validation failure — all produce user-friendly console errors |
| 7 | Document URL rendering protocol in README |

**Exit criteria:**
- [ ] URL rendering works with `window.Blu`
- [ ] XSS via string injection in URL config is impossible (sanitized)
- [ ] `_strict=1` rejects invalid configs with clear error
- [ ] `$auth` stripped from URL-loaded configs
- [ ] Oversized payloads rejected with clear error

**DO NOT:** Implement compression (`_renderz` is future). Don't implement server-side URL rendering.

---

### Sprint A6 — Data Layer (Weeks 3-5)

**Objective:** Create `@kitsy/blu-data` — data source registry, adapters, and binding resolution.

**Ref:** SSOT §6.4 (DataSource), §6.5 (ViewNodeDataBinding)

| # | Task |
|---|------|
| 1 | Create new package `@kitsy/blu-data` |
| 2 | Implement `DataSourceRegistry`: register(type, adapter), get(type), has(type) |
| 3 | Implement `RestAdapter`: fetch(config, params, context) → DataResult. Config shape: `{ url, method, headers }`. Support URL template variables `/api/products/{id}` |
| 4 | Implement `StaticAdapter`: fetch(config) → DataResult where `config.data` is inline JSON |
| 5 | Implement `StateAdapter`: fetch(config) → reads from globalState[config.key] |
| 6 | Implement `DataBindingResolver`: given ViewNode with `data` field, resolve source, apply mapping (prop ← path into result), return resolved props + loading/error/empty fallback URNs |
| 7 | Implement `RepeatResolver`: given ViewNode with `repeat` field, fetch data, produce N cloned ViewNode instances with item data injected into template props |
| 8 | Implement `ConditionalResolver`: given ViewNode with `when` field, evaluate condition (exists, eq, neq, gt, lt, in, empty, notEmpty), return boolean |
| 9 | Integrate resolvers into `@kitsy/blu-shell/core` config compiler |
| 10 | Implement caching: TTL-based per data source, staleWhileRevalidate, cache scope (global/view/session) |

**Exit criteria:**
- [ ] `@kitsy/blu-data` published
- [ ] RestAdapter fetches from URL, returns DataResult
- [ ] ViewNode with `data.source: "products"` bound to REST renders with fetched data
- [ ] ViewNode with `repeat` renders a list from REST response
- [ ] ViewNode with `when` conditionally renders/hides
- [ ] Loading, error, empty states render fallback components
- [ ] Cache with TTL and staleWhileRevalidate works
- [ ] Package has zero DOM dependencies
- [ ] 90%+ test coverage on public API

**DO NOT:** Implement GraphQL adapter, Supabase adapter, or BusAdapter (bus adapter needs transport from A8).

---

### Sprint A7 — Actions & Forms (Weeks 4-5)

**Objective:** Implement serializable actions on ViewNodes and the form contract.

**Ref:** SSOT §6.6 (Actions), §6.7 (Forms)

| # | Task |
|---|------|
| 1 | Add `actions` field to ViewNode processing in config compiler |
| 2 | Implement `ActionResolver` in `@kitsy/blu-shell/core`: resolves Action declarations to runtime handler functions |
| 3 | Implement all 6 action types: NavigateAction (→ NavigationStore), BusAction (→ EventBus.dispatch), MutateAction (→ DataSourceRegistry.mutate), StateAction (→ state set/merge/toggle/increment/append/remove), FormAction (reset/close), CompositeAction (sequence/parallel) |
| 4 | Wire resolved actions to React event handlers in the renderer (onClick → actions.onClick handler) |
| 5 | Add `mutate()` method to DataSourceAdapter interface and RestAdapter |
| 6 | Implement form contract in `@kitsy/blu-blocks`: `urn:blu:block:form` component that reads FormViewNode.form declaration |
| 7 | Form component: dispatches form:init on mount, form:change on field edit, form:validate per validation mode, form:submit → resolves submit.target action |
| 8 | Implement `urn:blu:ui:field` component: renders appropriate input for each FormFieldType |
| 9 | Implement field validation: required, minLength, maxLength, min, max, pattern |
| 10 | Register form and field components in ComponentRegistry with full ComponentMeta |

**Exit criteria:**
- [ ] Button with `actions.onClick: { type: "navigate", path: "/about" }` navigates
- [ ] Button with `actions.onClick: { type: "state", operation: "increment", key: "count" }` updates state
- [ ] MutateAction calls RestAdapter.mutate() and fires onSuccess/onError actions
- [ ] CompositeAction (sequence) executes actions in order
- [ ] Form with 3 fields (text, email, textarea) renders from JSON config
- [ ] Form validates on blur, shows errors, submits to REST endpoint
- [ ] All action types work via both ViewNode config and programmatic API

**DO NOT:** Implement form state sync to server (that's Phase 2). Don't build form builder UI (that's Studio).

---

### Sprint A8 — Transport Layer (Weeks 5-6)

**Objective:** Create `@kitsy/blu-wire` — transport interface and adapters making the EventBus network-transparent.

**Ref:** SSOT §6.9 (Command Envelope), §6.10 (Transport Interface)

| # | Task |
|---|------|
| 1 | Create new package `@kitsy/blu-wire` |
| 2 | Define Transport interface: send(envelope), onReceive(handler), connect(), disconnect(), state, onStateChange(handler) |
| 3 | Implement `LocalTransport` (wraps current in-process behavior) |
| 4 | Implement `BroadcastChannelTransport`: uses BroadcastChannel API for cross-tab sync. Commands with `$destination="*"` or absent relay to other tabs |
| 5 | Implement `WebSocketTransport`: connects to configurable URL, serializes Command as JSON, reconnection with exponential backoff (1s→2s→4s→8s→30s max), heartbeat ping/pong every 30s, offline queue (max 1000, FIFO eviction, dedup via `$correlationId`) |
| 6 | Implement `SSETransport`: server→browser via EventSource, browser→server via HTTP POST |
| 7 | Add `EventBus.attachTransport(transport)` method in `@kitsy/blu-bus`: when command has `$destination` not matching local → forward to transport; when transport receives → deliver to local bus; `$destination="*"` → local AND forward |
| 8 | Add `$`-prefix envelope metadata to CommandMeta: $source, $destination, $correlationId, $timestamp, $hop, $ttl, $sessionId, $auth |
| 9 | `$source` is set by the transport layer, never by the sender |
| 10 | Make Command.type extensible: remove fixed union, accept any string, validate via middleware |
| 11 | Ensure backward compatibility: apps that never call attachTransport() behave identically |

**Exit criteria:**
- [ ] `@kitsy/blu-wire` published
- [ ] BroadcastChannel: command in tab A appears in tab B
- [ ] WebSocket: connects to `ws://localhost` test server, sends and receives commands
- [ ] WebSocket: reconnects after disconnect with exponential backoff
- [ ] WebSocket: queues commands during disconnect, replays on reconnect, dedup works
- [ ] SSE: receives events, sends via POST
- [ ] `EventBus.attachTransport()` works without breaking non-transport apps
- [ ] `$`-prefix metadata fields set correctly
- [ ] Command.type accepts arbitrary strings
- [ ] Package has zero DOM deps (works in Node.js)

**DO NOT:** Implement server-side routing (Server track). Implement auth handling (server middleware). Import from `@kitsy/server`.

---

### Sprint A9 — Validation & Testing (Weeks 6-7)

**Objective:** Create `@kitsy/blu-validate` and `@kitsy/blu-test`.

**Ref:** SSOT §14 (Testing Strategy), Component Spec §15 (AI Generation Rules)

| # | Task |
|---|------|
| 1 | Create `@kitsy/blu-validate` package |
| 2 | Implement 7-step validation pipeline: (1) JSON Schema validation, (2) URN resolution against ComponentRegistry, (3) DataSource reference validation, (4) Action target validation, (5) Circular reference detection, (6) Render smoke test (headless, optional), (7) Accessibility baseline (required labels, alt text) |
| 3 | Export `validateConfig(config, registry?)` → `{ valid, errors, warnings }` |
| 4 | Export individual validators for use in CI/CLI: `validateSchema()`, `validateURNs()`, etc. |
| 5 | Create `@kitsy/blu-test` package |
| 6 | Implement `renderConfig(config)` → renders in JSDOM test environment, returns query helpers + bus + state |
| 7 | Implement `resolveViewTree(config)` → returns resolved ViewNode tree for snapshot testing |
| 8 | Implement bus simulation utilities: `createTestBus()` with command recording |
| 9 | Both packages have zero DOM dependencies in their core logic (JSDOM is a test-time dependency only) |

**Exit criteria:**
- [ ] `@kitsy/blu-validate` published
- [ ] `validateConfig(validConfig)` returns `{ valid: true }`
- [ ] `validateConfig(configWithBadURN)` returns error at step 2
- [ ] `validateConfig(configWithDanglingSource)` returns error at step 4
- [ ] `@kitsy/blu-test` published
- [ ] `renderConfig(config)` works in Jest/Vitest
- [ ] `resolveViewTree(config)` produces a snapshotable tree
- [ ] Test bus records dispatched commands

**DO NOT:** Implement auto-fix engine (that's Mind spec). Don't build browser-based validation UI.

---

### Sprint A10 — DevTools & CLI (Weeks 7-8)

**Objective:** Create `@kitsy/blu-devtools`, `@kitsy/blu-cli`, and `@kitsy/create-blu`.

**Ref:** SSOT §11 (Observability)

| # | Task |
|---|------|
| 1 | Create `@kitsy/blu-devtools` — React app connected to inspected app via BroadcastChannelTransport |
| 2 | DevTools: Bus inspector tab — real-time command stream with type/target/source filters, click to expand payload |
| 3 | DevTools: State viewer tab — live globalState tree with diff highlighting on changes |
| 4 | DevTools: open in separate tab via `window.Blu.openDevTools()` or keyboard shortcut |
| 5 | Create `@kitsy/blu-cli` (Node.js CLI): `blu dev` (Vite dev server), `blu build` (production build, bundle size report), `blu validate <config.json>` (runs validation pipeline), `blu export` (export config as standalone HTML) |
| 6 | Create `@kitsy/create-blu`: `npx @kitsy/create-blu my-app` scaffolder with templates: blank, landing, dashboard |
| 7 | `blu build` includes bundle size check — fail if core > 150KB gzipped |
| 8 | `blu validate` uses `@kitsy/blu-validate` pipeline |

**Exit criteria:**
- [ ] `@kitsy/blu-devtools`: bus inspector shows live commands across tabs
- [ ] `@kitsy/blu-devtools`: state viewer shows globalState changes
- [ ] `blu dev` starts Vite dev server for a Blu app
- [ ] `blu build` produces production bundle with size report
- [ ] `blu validate config.json` reports validation results
- [ ] `npx @kitsy/create-blu my-app` scaffolds a working project
- [ ] `blu dev` on scaffolded project starts and renders

**DO NOT:** Build config explorer or ViewNode tree inspector (those depend on Studio-level understanding). Don't build deployment features.

---

## 2. Phase 1 Gate

**ALL of these must be true before declaring Phase 1 complete:**

- [ ] All 20 `@kitsy/blu-*` packages published on npm
- [ ] `window.Blu.render(config)` works via CDN script tag
- [ ] `npm install @kitsy/blu-shell` → working app with full TypeScript
- [ ] ViewNode tree renders alongside existing ReactNode path
- [ ] `@kitsy/blu-bus` usable standalone (npm install, import, dispatch)
- [ ] `@kitsy/blu-types` JSON Schema validates example configs in CI
- [ ] Bundle size < 150KB gzipped (core)
- [ ] `@kitsy/blu-wire` WebSocket transport connects and relays
- [ ] `@kitsy/blu-validate` 7-step pipeline works on any config
- [ ] `@kitsy/blu-data` fetches REST data and binds to ViewNodes
- [ ] Forms render from JSON config with validation
- [ ] Actions (navigate, state, mutate, bus, composite) all work
- [ ] DevTools shows live bus inspector
- [ ] CLI scaffolds, builds, and validates projects

---

## 3. Track Governance

### Code rules

```
ALL code:
  - TypeScript strict mode, no `any`
  - JSDoc on public functions
  - >80% test coverage on public API
  - ESLint zero warnings

UNIVERSAL packages (blu-bus, blu-data, blu-types, blu-validate, blu-wire, blu-shell/core, blu-route):
  - MUST NOT import React, ReactDOM, or any DOM API
  - MUST run in Node.js without polyfills
  - CI check: grep for "react" → fail build

REACT packages (blu-shell/react, blu-context, blu-core, blu-ui, blu-grid, blu-blocks, blu-icons, blu-templates, blu-devtools):
  - React as peerDependency (^18.0.0 || ^19.0.0)
  - Functional components only
  - Accept standard HTML attributes (className, style, id)
```

### Dependency direction (ALLOWED)

```
blu-shell → blu-bus, blu-core, blu-ui, blu-route, blu-style, blu-context, blu-data
blu-ui → blu-core, blu-style
blu-blocks → blu-ui, blu-core, blu-style, blu-bus
blu-data → blu-bus
blu-wire → blu-bus
blu-devtools → blu-bus (via BroadcastChannel only)
blu-validate → blu-types
blu-test → blu-types, blu-validate
```

### Dependency direction (FORBIDDEN)

```
blu-bus → anything (zero deps — foundational)
blu-types → anything (zero deps — types only)
Any @kitsy/blu-* → @kitsy/server
Any @kitsy/blu-* → @kitsy/studio or @kitsy/mind
```

### Bus command naming

```
Format: {module}:{entity}:{action}
For Blu: blu:config:updated, blu:site:published, etc.
All lowercase, colon-separated, past tense for events, present for commands.
```

### Sprint handoff template

```markdown
## Sprint {ID} Complete

### What shipped
- Package(s): @kitsy/blu-{name} v{version}
- Key files changed: [list]

### Exit criteria
- [ ] Criterion 1: [evidence/test name]
- [ ] Criterion 2: [evidence/test name]
- [ ] CI passing: [link or confirmation]
- [ ] Bundle size: [number]KB gzipped

### Decisions made not in spec
- [Any decisions the agent made that aren't in the SSOT]

### Known issues deferred
- [Anything skipped or incomplete]

### What next sprint needs
- [Published package versions to depend on]
- [API contracts to use]
```

---

## 4. Agent Prompt Template

Use this to generate prompts for any Blu sprint:

```
SPRINT: A{N} — {Title}
TRACK: A (Blu Framework)
PHASE: 1 (Active)
DEPENDS ON: {Previous sprint IDs and what they ship}

SPEC REFERENCE: Blu SSOT §{section} ({topic})

OBJECTIVE:
{One sentence}

TASKS:
1. {Specific task}
2. ...

EXIT CRITERIA:
- [ ] {Measurable criterion}
- [ ] ...

DO NOT:
- {Scope exclusion}
- {Another exclusion}
- Touch anything related to Server, Studio, Mind, or platform shell
- Modify packages outside this sprint's scope without documenting why
```
