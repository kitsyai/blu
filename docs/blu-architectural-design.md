# Kitsy Platform — Architectural Roadmap

**Version**: 1.2 (Draft) | **Date**: 2026-03-22
**Scope**: Strategic architecture, branding, and licensing for the kitsy.ai ecosystem
**Audience**: Founder, architects, investors, implementation teams

---

## Brand Hierarchy

```
  Kitsy (kitsy.ai)
  ├── The company, the org, the platform brand
  ├── AI-native application platform for businesses
  │
  ├── Blu ← the open-source UI framework (this repo)
  │   ├── @kitsy/blu-bus        (EventBus, Effects, Channels)
  │   ├── @kitsy/blu-shell      (Application orchestration, render)
  │   ├── @kitsy/blu-core       (Base primitives)
  │   ├── @kitsy/blu-ui         (Component library)
  │   ├── @kitsy/blu-route      (Navigation)
  │   ├── @kitsy/blu-style      (Theme, tokens, CSS builder)
  │   ├── @kitsy/blu-context    (Hooks, AppContext)
  │   ├── @kitsy/blu-grid       (Layout)
  │   ├── @kitsy/blu-icons      (Icon set)
  │   ├── @kitsy/blu-blocks     (Widgets — Hero, Form, Canvas)
  │   └── @kitsy/blu-templates  (Pre-built templates)
  │
  ├── Kitsy Studio ← no-code builder (proprietary)
  ├── Kitsy Mind   ← AI agent framework (proprietary)
  ├── Kitsy Server ← server runtime (BSL)
  └── kitsy.ai     ← hosted platform (SaaS)
```

**Key distinction:** Blu is ONE product under Kitsy — the open-source UI framework that powers everything. Kitsy is the company that builds products and services on top of Blu (and beyond). A developer can use Blu without ever touching kitsy.ai. A business user can use kitsy.ai without ever knowing Blu exists.

**Single npm scope:** Everything lives under `@kitsy`. The `blu-` prefix cleanly separates the open-source framework packages from proprietary platform packages — no need for two npm orgs.

---

## Context

**Kitsy** is a company building AI-native application tools for businesses — website builders, CRM, AI agents, domain management, hosting, and more. All of these are delivered through the **kitsy.ai platform**.

**Blu** is Kitsy's open-source UI framework — currently the `@pkvsinha/react-*` monorepo (11 packages, v0.0.12). Blu abstracts away HTML through a data-driven contract, decouples UI from state through an EventBus/Redux-inspired architecture, and provides a message-fabric integration layer inspired by Apache Camel. Blu is the rendering engine that powers kitsy.ai, but it stands alone as a general-purpose framework any developer can adopt.

The existing architecture already has critical extension points: the EventBus middleware chain, the adapter pattern in NavigationStore, the channels ask/answer RPC, the extensible `Command.meta` field, and the `ApplicationConfiguration` contract with its `ext` bag. This plan builds on these foundations.

---

## PHASE 0: CURRENT STATE (v0.0.12)

### What Exists (Blu Framework)

```
                        app (→ @kitsy/blu-shell)
                     /   |   \
              navigate  hooks  components  widgets  layout  templates
                  |      |
              integrate  |
                  |      |
                  +------+--- (integrate is the foundation)

              theme (standalone)    base (primitives)    icons
```

**Core Primitives:**
- **EventBus** — Command-based `{type, target, payload, meta}`, middleware chain, 8 command types
- **Effects** — Saga-like: onEvery, onLatest, onDebounce, onThrottle with AbortSignal
- **Channels** — publish/subscribe + ask/answer RPC with correlation IDs
- **RequestCache** — TTL + inflight dedup
- **ComponentRegistry** — URN-keyed component map
- **NavigationStore** — Adapter pattern: `attachBrowserAdapter()`, `attachMemoryAdapter()`
- **ApplicationConfiguration** — Universal schema: views, config, dataSources, actions, permissions, registry, i18n, plugins, globalState, ext
- **Theme CssBuilder** — ITCSS 7-layer cascade with design tokens and plugin system
- **SSR support** — `render()` for browser, `renderToStringSSR()` for server

### Gaps to Address

| Gap | Severity | Phase |
|-----|----------|-------|
| EventBus is in-process only; no network transport | Critical | 1 |
| No command envelope metadata for routing ($source, $destination) | Critical | 1 |
| No auth/authorization middleware | Critical | 2 |
| `View.view` accepts `React.ReactNode` (not serializable) | Critical | 3 |
| No config versioning or persistence | Critical | 2 |
| No runtime token swap protocol for live theme preview | Medium | 3 |
| Singleton bus; no factory for isolated instances | Medium | 2 |
| `Command.type` is a fixed union; no extensibility | Medium | 1 |

---

## PHASE 1: TRANSPORT LAYER (Blu → Network-Transparent)

**Goal:** Make the Blu EventBus network-transparent. A command sent in a browser reaches the Kitsy server (or another tab) without the sender knowing the transport.

### Architecture

```
 Browser A                      Kitsy Server                    Browser B
+-----------+                  +---------------+                +-----------+
| Blu       |                  | Blu           |                | Blu       |
| EventBus  |                  | EventBus      |                | EventBus  |
| (local)   |                  | (server)      |                | (local)   |
+-----+-----+                  +-------+-------+                +-----+-----+
      |                                |                              |
+-----v-----+                  +-------v-------+                +-----v-----+
| Transport  |<--- WebSocket -->| Transport     |<--- WebSocket -->| Transport  |
|  Adapter   |    (or SSE/HTTP) |   Adapter     |    (or SSE/HTTP) |  Adapter   |
+------------+                  +---------------+                +------------+

       BroadcastChannel (cross-tab within same browser)
       <------------------------------------------------>
```

### Key Contracts

**Transport Interface:**
```
Transport {
  send(envelope: Envelope): Promise<void>
  onReceive(handler: (envelope: Envelope) => void): Unsubscribe
  connect(): Promise<void>
  disconnect(): Promise<void>
  state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  onStateChange(handler: (state) => void): Unsubscribe
}
```

**Command Envelope (extends existing `meta` — zero breaking changes):**

| Meta Key | Type | Purpose |
|----------|------|---------|
| `$source` | string | Originating endpoint ID (`browser:abc`, `server`, `ai:agent-1`) |
| `$destination` | string \| `"*"` | Target endpoint or broadcast |
| `$correlationId` | string | Links request/response (channels already uses this) |
| `$timestamp` | number | Epoch ms at origin |
| `$hop` | number | Incremented on relay (prevents loops) |
| `$ttl` | number | Max hops before discard |
| `$sessionId` | string | Server session ID |
| `$auth` | string | JWT token (stripped before forwarding to other browsers) |

Dollar-prefix convention keeps existing `meta.key` (debounce) unaffected.

**Transport Implementations:**

| Transport | Direction | Use Case |
|-----------|-----------|----------|
| `LocalTransport` | in-process | Default (current behavior) |
| `WebSocketTransport` | bidirectional | Primary browser↔server |
| `SSETransport` | server→browser + HTTP POST | Firewall-friendly fallback |
| `BroadcastChannelTransport` | cross-tab | Multi-tab sync |
| `HTTPPollingTransport` | bidirectional polling | Last-resort fallback |

**Routing Rule:** If `$destination` is set and doesn't match local endpoint, forward to transport. If `$destination` is `"*"` or absent, deliver locally AND forward.

**Reconnection:** Exponential backoff (1s→2s→4s→8s→max 30s), heartbeat ping/pong every 30s, offline queue (max 1000 commands, FIFO eviction for non-critical), dedup on replay via `$correlationId`.

### New Package
- `@kitsy/blu-wire` — Transport interface + WebSocket/SSE/BroadcastChannel adapters

### Files Modified
- `packages/integrate/src/types.ts` — `$`-prefixed meta key type hints
- `packages/integrate/src/EventBus.ts` — `attachTransport(transport)` method
- `packages/integrate/src/index.ts` — re-export transport types

### Backward Compatibility
Commands without `$destination` behave identically to today. Apps that never call `attachTransport()` are unaffected.

---

## PHASE 2: KITSY SERVER

**Goal:** A Node.js server that is itself a Blu EventBus participant — manages sessions, stores ApplicationConfiguration, and acts as state authority. This is the first piece that belongs to Kitsy (the platform) rather than Blu (the framework).

### Architecture

```
                        Kitsy Server
+----------------------------------------------------------+
|  +----------------+    +-------------------+             |
|  |  HTTP/WS       |    |  Session Manager  |             |
|  |  Gateway       |--->|  (connection pool) |             |
|  +----------------+    +--------+----------+             |
|                                 |                        |
|  +----------------+    +--------v----------+             |
|  |  Blu           |<-->|  Command Router   |             |
|  |  EventBus      |    |  (fan-out/filter) |             |
|  |  (server-side) |    +-------------------+             |
|  +-------+--------+                                      |
|          |                                               |
|  +-------v--------+    +-------------------+             |
|  |  Config Store  |    |  State Store      |             |
|  |  (versioned    |    |  (per-session     |             |
|  |   AppConfig)   |    |   state replica)  |             |
|  +----------------+    +-------------------+             |
|                                                          |
|  +----------------+    +-------------------+             |
|  |  Auth Provider |    |  Tenant Manager   |             |
|  |  (JWT/session) |    |  (multi-tenant)   |             |
|  +----------------+    +-------------------+             |
+----------------------------------------------------------+
```

### Session Management

| Field | Type | Purpose |
|-------|------|---------|
| sessionId | string | Unique per connection |
| tenantId | string | Which kitsy.ai customer |
| userId | string | Authenticated user |
| transport | Transport | WebSocket/SSE connection |
| configVersion | number | Browser's current config version |
| stateSnapshot | object | Last known browser state |

### Config Store (Versioned)

```
ConfigStore {
  get(tenantId, siteId): VersionedConfig
  save(tenantId, siteId, config): version
  diff(tenantId, siteId, fromVersion, toVersion): ConfigPatch  // JSON Patch RFC 6902
  history(tenantId, siteId, limit): VersionEntry[]
  rollback(tenantId, siteId, toVersion): VersionedConfig
}
```

### State Synchronization Protocol

For premium "server-managed state" — server is authority, browser is replica:

1. **Initial sync**: On connect, server sends full ApplicationConfiguration + state
2. **Incremental updates**: Server sends JSON Patch (RFC 6902) diffs
3. **Optimistic updates**: Browser applies locally, sends to server. Server validates, confirms or rejects with corrective patch
4. **Conflict resolution**: Last-writer-wins default; configurable merge semantics per-key

```
Sync Protocol (bus commands with type: "broadcast"):

  Topic: "sync:config"
    server → browser: { version, patch: JSONPatch[] }
    browser → server: { ack: version }

  Topic: "sync:state"
    server → browser: { key, value, version }
    browser → server: { key, value, expectedVersion }
    server → browser: { key, value, version, conflict?: true }
```

### Command Routing

1. Auth middleware validates `meta.$auth` JWT
2. Route by `meta.$destination`: `"server"` → server effects, `"browser:xyz"` → specific session, `"tenant:*"` → all tenant sessions, `"*"` → broadcast
3. Append to command log for observability

### New Packages
- `@kitsy/server` — Node.js server (separate repo)
- `@kitsy/blu-sync` — Client-side sync protocol, JSON Patch application (part of Blu — any app can sync)
- `@kitsy/protocol` — Shared types (Envelope, SyncMessage, etc.)

### Runtime Decision
**Node.js + `ws`** — reuses Blu EventBus code isomorphically (zero DOM deps in integrate). Migrate to Bun when mature.

---

## PHASE 3: KITSY STUDIO (No-Code Builder)

**Goal:** A visual editor that produces `ApplicationConfiguration`. The builder is itself a Blu app — proving Blu's power while being a proprietary Kitsy product.

### Architecture

```
+-----------------------------------------------------------------------+
|                          Kitsy Studio                                  |
|  +------------------+  +------------------+  +--------------------+  |
|  |  Component       |  |  Canvas          |  |  Property Panel    |  |
|  |  Palette         |  |  (live preview)  |  |  (config editor)   |  |
|  |  (from Blu       |  |  (iframe running |  |  (JSON schema UI)  |  |
|  |   Registry)      |  |   Blu app)       |  |                    |  |
|  +--------+---------+  +--------+---------+  +---------+----------+  |
|           |                      |                      |            |
|           +----------+-----------+----------------------+            |
|              +-------v--------+                                      |
|              |  Builder State |  (AppConfig in memory)               |
|              |  Manager       |  (every edit = bus command)          |
|              +-------+--------+                                      |
|              +-------v--------+                                      |
|              |  Sync to Kitsy |  (Phase 2 protocol)                  |
|              |  Server        |                                      |
|              +----------------+                                      |
+-----------------------------------------------------------------------+
```

### Core Innovation: ViewNode (Serializable View)

The current `View.view` accepts `React.ReactNode` (not serializable). The builder introduces a parallel serializable representation:

```
ViewNode {
  id: string
  componentUrn: string           // References Blu ComponentRegistry
  props: Record<string, unknown> // Serializable props
  children?: ViewNode[]          // Nested components
  slot?: string                  // Parent slot
  style?: Record<string, unknown>
  responsive?: Record<BreakpointKey, Partial<ViewNode>>
}

SerializableView extends View {
  children: ViewNode[]           // The UI tree as data
}
```

This is the heart of no-code: the entire UI is a tree of ViewNodes referencing Blu components by URN with serializable props. **This is also what the LLM generates in Phase 4.**

### Component Palette (extends existing Blu Registry)

```
ComponentMeta {
  urn: string                    // "urn:blu:widget:hero"
  displayName: string            // "Hero Banner"
  category: string               // "Marketing", "Form", "Layout"
  thumbnail: string
  defaultProps: Record<string, unknown>
  propSchema: JSONSchema          // Auto-generates property panel
  slots: string[]                // Named content slots
}
```

`componentRegistry.register(urn, comp, meta?)` — backward compatible extension to Blu.

### Live Preview
**iframe with same-origin** — true isolation, accurate rendering. Preview receives ApplicationConfiguration via postMessage (another Blu Transport adapter).

### Template Marketplace
Templates are ApplicationConfiguration documents stored with `tenantId: "marketplace"`. Users browse → preview → fork to their tenant on kitsy.ai.

### New Packages
- `@kitsy/studio` — Builder UI (palette, canvas, property panel) — proprietary
- `@kitsy/canvas` — ViewNode model, serialization, validation — proprietary

---

## PHASE 4: KITSY MIND (AI Integration)

**Goal:** AI becomes a first-class Blu bus participant. It receives commands, sends commands, and generates ApplicationConfiguration from natural language. This is a Kitsy platform capability built on the Blu transport layer.

### Architecture

```
+-----------------------------------------------------------------------+
|                          Kitsy Mind                                    |
|  +------------------+  +------------------+  +--------------------+  |
|  |  LLM Gateway     |  |  Prompt Engine   |  |  Config Generator  |  |
|  |  (Claude/OpenAI  |  |  (schema + few-  |  |  (NL → AppConfig)  |  |
|  |   /local model)  |  |   shot examples) |  |  (NL → ViewNode)   |  |
|  +--------+---------+  +--------+---------+  +---------+----------+  |
|              +-------v--------+                                      |
|              |  AI Bus Agent  |  ($source: "ai:agent-1")             |
|              |  (connects via |                                      |
|              |   Blu bus)     |                                      |
|              +-------+--------+                                      |
|              +-------v--------+                                      |
|              |  Kitsy Server  |  (AI is just another endpoint)       |
|              |  EventBus      |                                      |
|              +----------------+                                      |
+-----------------------------------------------------------------------+
```

### Key Principle: AI is Not Special

AI agents connect to the Kitsy Server's Blu EventBus like any other participant. `$source: "ai:agent-1"`. They use the same channels ask/answer RPC. The Blu bus doesn't care if the endpoint is a browser, a server process, or an LLM — they all speak the same Command protocol.

### Conversational Builder Flow

```
1. User in Kitsy Studio: "Create a landing page for my bakery"
2. Studio sends via Blu bus: ask("ai:generate-site", { prompt, availableComponents, themeTokens })
3. Kitsy Mind constructs LLM prompt with ApplicationConfiguration schema + Blu ComponentRegistry URNs
4. LLM returns: ApplicationConfiguration JSON with ViewNode trees
5. Kitsy Mind validates against schema
6. Kitsy Mind responds via answer()
7. Studio applies → Kitsy Server syncs → live preview updates via Blu bus
```

### AI Agent Types

| Agent | Subscribes To | Sends |
|-------|--------------|-------|
| Site Builder | `ai:generate-site`, `ai:edit-section` | Config patches |
| Theme Advisor | `ai:suggest-theme` | Blu token overrides |
| Content Writer | `ai:write-copy` | Text content patches |
| Analytics Agent | `analytics:*` | Insight reports |
| CRM Agent | `crm:*` | Customer action recommendations |
| Business Assistant | `ai:business:*` | Business management actions |

### New Packages
- `@kitsy/mind` — AI agent framework, LLM gateway abstraction — proprietary
- `@kitsy/prompts` — Prompt templates, schema instructions, few-shot examples — proprietary

---

## PHASE 5: KITSY PLATFORM SERVICES

**Goal:** The full kitsy.ai hosted platform — everything a business needs for online presence and management.

### Architecture

```
+------------------------------------------------------------------+
|                        kitsy.ai Platform                         |
|  +-----------+  +----------+  +----------+  +---------------+   |
|  |  Auth &   |  | Tenant   |  | Billing  |  | Domain        |   |
|  |  Identity |  | Manager  |  | (Stripe) |  | (Namecheap)   |   |
|  +-----------+  +----------+  +----------+  +---------------+   |
|  +-----------+  +----------+  +----------+  +---------------+   |
|  |  Config   |  | Asset    |  | CDN      |  | Analytics     |   |
|  |  Store    |  | Store    |  | (deploy) |  | (events)      |   |
|  +-----------+  +----------+  +----------+  +---------------+   |
|  +-----------+  +----------+  +----------+  +---------------+   |
|  |  CRM      |  | Email    |  | Plugin   |  | Marketplace   |   |
|  |  Service  |  | Service  |  | Runtime  |  | (templates)   |   |
|  +-----------+  +----------+  +----------+  +---------------+   |
|                                                                  |
|  All services are Blu bus participants on Kitsy Server           |
+------------------------------------------------------------------+
```

**Key insight:** Every platform service is a Blu bus participant. Domain registration, billing, CRM — they all send and receive Commands through the same EventBus. This is the Apache Camel-inspired vision made real.

### Multi-Tenant Isolation
Enforced at the bus level — auth middleware extracts `tenantId` from JWT, router middleware filters commands by tenant. No cross-tenant data leakage possible.

### Domain Registration (Namecheap API as bus service)
```
ask("platform:domain-check", { domain: "mybakery.com" }) → { available, price }
ask("platform:domain-register", { domain, years }) → { success, expiresAt }
```

### Publish Flow
1. ConfigStore retrieves latest ApplicationConfiguration
2. Blu's `renderToStringSSR()` generates static HTML
3. CssBuilder generates CSS from Blu theme tokens
4. Assets collected → uploaded to CDN (S3+CloudFront or Cloudflare R2)
5. DNS configured to point domain to CDN
6. For server-managed sites (premium): long-running Kitsy Server handles WebSocket + hydration

### Plugin Marketplace
```
KitsyPlugin {
  name: string
  version: string
  type: "component" | "theme" | "effect" | "service"
  install(bus, registry, config): void   // bus = Blu EventBus
  uninstall(): void
}
```
Maps directly to existing Blu `ApplicationConfiguration.plugins` field.

---

## PHASE 6: MULTI-PLATFORM (Blu Universal)

**Goal:** Same ApplicationConfiguration renders on web, mobile, and desktop. This is a Blu framework evolution — the renderer becomes platform-agnostic.

### Architecture

```
                    ApplicationConfiguration
                    (Blu data contract)
                            |
                    +-------+-------+
                    |               |
              +-----v-----+  +-----v-----+
              |  Blu       |  |  Blu       |
              |  Renderer  |  |  Renderer  |
              |  Interface |  |  Interface |
              +-----+-----+  +-----+-----+
                    |               |
        +-----------+----+    +-----+-----+
        |           |    |    |           |
   +----v----+ +----v-+ +v---v---+  +----v----+
   |  React  | | React| |Flutter | |Electron |
   |  DOM    | | Native| |       | | Desktop |
   +---------+ +------+ +--------+ +---------+
```

### What's Shared Across Platforms

| Layer | Shared? | Notes |
|-------|---------|-------|
| `@kitsy/blu-bus` (EventBus, Effects, Channels) | 100% | Zero DOM dependencies |
| `@kitsy/blu-route` (NavigationStore) | 100% | Adapter pattern supports non-browser |
| `@kitsy/blu-context` (AppContext, reducer) | React-based only | Flutter needs equivalent |
| `@kitsy/blu-style` (tokens) | Token layer shared | CSS layer web-only; native needs mapping |
| `@kitsy/blu-ui` (components) | Per-platform | Each platform has own component library |
| `@kitsy/blu-shell` (compile, prepareApp) | Shared | Config compilation is platform-agnostic |

The `@kitsy/blu-bus` package having zero DOM imports is the key architectural advantage — it IS the universal core.

---

## CROSS-CUTTING CONCERNS

### Security Model
- **Authentication**: JWT in `meta.$auth`, validated on every server-bound command
- **Authorization**: Role-based via `ApplicationConfiguration.permissions`, Kitsy Server middleware enforced
- **Tenant Isolation**: Bus-level routing — single enforcement point, cannot be bypassed
- **Transport**: WSS (TLS) for all connections, CORS restrictions

### Offline / Reconnection
1. Detect disconnect via Blu Transport state
2. Queue commands locally (max 1000, FIFO eviction)
3. Exponential backoff reconnection
4. On reconnect: send `configVersion`, receive JSON Patch delta
5. Replay queued commands; idempotency via `$correlationId`

### Performance
- **Batching**: Middleware collects commands for 50ms, sends as array
- **Diffing**: JSON Patch is O(patch), not O(config)
- **Theme**: CssBuilder runs server-side; browser receives compiled CSS
- **Rendering**: React re-renders only affected subtrees

### Observability
- **Tracing**: `$correlationId` links commands across browser→server→AI→browser
- **Logging**: Bus middleware (existing `enableLogging()` is the template)
- **Metrics**: Command counts, middleware latency, session counts — all emitted as bus commands

### Schema Evolution
1. `$schemaVersion: number` on ApplicationConfiguration
2. Migration functions: version N → N+1
3. Kitsy Server applies migration chain on config load
4. New fields always optional — no breaking changes

---

## SEQUENCING AND DEPENDENCIES

```
Phase 0 (current, v0.x) — Blu framework
    |
Phase 1 (Transport Layer) — Blu becomes network-aware
    |
Phase 2 (Kitsy Server) ─── depends on Phase 1
    |
    ├──> Phase 3 (Kitsy Studio) ─── depends on Phase 2
    |         |
    |         └──> Phase 4 (Kitsy Mind / AI) ─── depends on Phase 3
    |
    └──> Phase 5 (Platform Services) ─── can start with Phase 2
              |
              └──> Phase 6 (Multi-Platform) ─── can start with Phase 3
```

### Package Ownership Summary

| Phase | Package | Owner | License |
|-------|---------|-------|---------|
| 0 | `@kitsy/blu-bus` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-shell` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-core` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-ui` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-route` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-style` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-context` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-grid` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-icons` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-blocks` | Blu (OSS) | Apache 2.0 |
| 0 | `@kitsy/blu-templates` | Blu (OSS) | Apache 2.0 |
| 1 | `@kitsy/blu-wire` | Blu (OSS) | Apache 2.0 |
| 2 | `@kitsy/blu-sync` | Blu (OSS) | Apache 2.0 |
| 2 | `@kitsy/protocol` | Kitsy | BSL |
| 2 | `@kitsy/server` | Kitsy | BSL |
| 3 | `@kitsy/studio` | Kitsy | Proprietary |
| 3 | `@kitsy/canvas` | Kitsy | Proprietary |
| 4 | `@kitsy/mind` | Kitsy | Proprietary |
| 4 | `@kitsy/prompts` | Kitsy | Proprietary |

---

## KEY ARCHITECTURAL DECISIONS

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Brand split | Blu (framework) vs Kitsy (platform) | Framework adoption ≠ platform lock-in; developers choose Blu freely |
| npm scope | Single `@kitsy` org, `blu-` prefix for framework | One npm org, one billing, clean separation via naming convention |
| Transport location | EventBus middleware | Keeps Blu bus API unchanged; zero breaking changes |
| Command envelope | `$`-prefixed meta keys | No schema change to Blu Command type |
| Server runtime | Node.js + `ws` | Reuses Blu EventBus code isomorphically |
| Config diffing | JSON Patch (RFC 6902) | Standard, minimal payload |
| Builder preview | iframe (same-origin) | True isolation, accurate rendering via Blu |
| AI pattern | Blu bus participant via channels | AI is just another endpoint |
| View serialization | ViewNode tree + Blu component URNs | Serializable, LLM-generatable, renderer-agnostic |
| Multi-platform core | `@kitsy/blu-bus` package | Zero DOM deps = universal |
| Tenant isolation | Bus-level routing middleware | Single enforcement point on Kitsy Server |
| Schema evolution | Version + migration chain | Never breaks stored configs |

---

## BRANDING AND IDENTITY

### npm Scope — Single `@kitsy` Org

| Prefix | Purpose |
|--------|---------|
| `@kitsy/blu-*` | Open-source Blu framework packages |
| `@kitsy/studio`, `@kitsy/mind`, etc. | Proprietary platform packages |
| `@kitsy/server`, `@kitsy/protocol` | BSL platform infrastructure |

### Org Migration: `@pkvsinha/react-*` → `@kitsy/blu-*`

**Migration strategy:**
1. Register `@kitsy` org on npm (requires npm org plan)
2. Publish new versions under `@kitsy/blu-*` scope
3. Keep `@pkvsinha/react-*` as deprecated aliases pointing to `@kitsy/blu-*` for 6 months
4. Update all internal imports, package.json references, and documentation

### Package Naming: From Technical to Brand

| Current Package | Blu Name | Rationale |
|----------------|----------|-----------|
| `@pkvsinha/react-app` | `@kitsy/blu-shell` | The outer shell that wraps everything — render, bootstrap, orchestration |
| `@pkvsinha/react-base` | `@kitsy/blu-core` | Foundation primitives (Box, Text, Container) |
| `@pkvsinha/react-components` | `@kitsy/blu-ui` | The visible UI component library |
| `@pkvsinha/react-integrate` | `@kitsy/blu-bus` | The message bus — the heart of the system |
| `@pkvsinha/react-navigate` | `@kitsy/blu-route` | Routing and navigation |
| `@pkvsinha/react-theme` | `@kitsy/blu-style` | Theming, tokens, CSS builder |
| `@pkvsinha/react-hooks` | `@kitsy/blu-context` | Application context and hooks |
| `@pkvsinha/react-layout` | `@kitsy/blu-grid` | Layout primitives |
| `@pkvsinha/react-icons` | `@kitsy/blu-icons` | Icon set |
| `@pkvsinha/react-widgets` | `@kitsy/blu-blocks` | Higher-level building blocks (Hero, Form, Canvas) |
| `@pkvsinha/react-templates` | `@kitsy/blu-templates` | Pre-built templates |

### Domain and Web Presence

| Asset | Purpose |
|-------|---------|
| `kitsy.ai` | Main platform — builder, hosting, dashboard, business tools |
| `blu.kitsy.ai` | Framework docs, API reference, getting started guides |
| `npmjs.com/org/kitsy` | All packages (framework + platform) |
| `github.com/kitsy-ai` | Organization for all repos |
| `github.com/kitsy-ai/blu` | Open-source framework repo |

### Taglines

- **Blu** — "UI as data. Render anything."
- **Kitsy Studio** — "Design without code"
- **Kitsy Mind** — "AI that builds with you"
- **kitsy.ai** — "Your business, online, in minutes"

---

## OPEN SOURCE vs CLOSED SOURCE STRATEGY

### Open Core Model

```
+------------------------------------------------------------------+
|                    OPEN SOURCE (Apache 2.0)                      |
|                           "Blu"                                  |
|                                                                  |
|  @kitsy/blu-bus      @kitsy/blu-core     @kitsy/blu-ui          |
|  @kitsy/blu-route    @kitsy/blu-style    @kitsy/blu-context     |
|  @kitsy/blu-grid     @kitsy/blu-icons    @kitsy/blu-blocks      |
|  @kitsy/blu-templates @kitsy/blu-shell   @kitsy/blu-wire        |
|  @kitsy/blu-sync                                                 |
|                                                                  |
|  (The framework — anyone can use, contribute, build on)          |
+------------------------------------------------------------------+
                              |
+------------------------------------------------------------------+
|                    PROPRIETARY / BSL                              |
|                      "Kitsy Platform"                            |
|                                                                  |
|  @kitsy/studio     @kitsy/canvas     @kitsy/mind                |
|  @kitsy/protocol   @kitsy/prompts    @kitsy/server              |
|                                                                  |
|  kitsy.ai platform (hosting, domain, CRM, billing, marketplace) |
|                                                                  |
|  (The platform — monetized, competitive moat)                    |
+------------------------------------------------------------------+
```

### Why This Split Works

**Open source Blu (Phases 0-1):**
- **Adoption**: Developers try `@kitsy/blu-bus` or `@kitsy/blu-style` standalone. They build trust, file issues, contribute. This is the funnel into kitsy.ai.
- **Quality**: Community eyes find bugs faster. Enterprise developers validate edge cases.
- **Hiring signal**: Good open-source projects attract talent.
- **Standards**: If `@kitsy/blu-bus` becomes the go-to EventBus for React, kitsy.ai has natural lock-in.
- **No competitive risk**: Blu without Kitsy is useful but not a business. Nobody will out-execute Kitsy on the platform layer.
- **Clear boundary**: Blu has its own identity. Developers don't feel they're adopting "a product" — they're adopting a framework.
- **Brand halo**: Every `@kitsy/blu-*` import reinforces the Kitsy brand without being pushy.

**Keep Kitsy platform proprietary (Phases 3-5):**
- **Moat**: The no-code builder, AI agents, hosting, and domain management are the value.
- **Data advantage**: User-created sites, templates, and AI training data are proprietary assets.
- **Speed**: Iterate on proprietary code faster without open-source governance overhead.

### License Recommendations

| Layer | License | Rationale |
|-------|---------|-----------|
| Blu framework packages (`@kitsy/blu-*`) | **Apache 2.0** | Permissive, patent protection, enterprise-friendly |
| Kitsy Server (self-hosted) | **BSL (Business Source License)** | Source-available, converts to open source after 3-4 years. Prevents cloud providers from competing. |
| kitsy.ai platform | **Proprietary** | SaaS — Terms of Service govern usage |
| AI components (Mind, Prompts) | **Proprietary** | Prompts, training data, agent logic are competitive advantages |

### Revenue Model

| Tier | What They Get | Price Model |
|------|--------------|-------------|
| **Free (OSS)** | Blu framework (`@kitsy/blu-*`), self-hosted everything | Free forever |
| **Starter** | kitsy.ai builder, 1 site, kitsy subdomain | Free / freemium |
| **Pro** | Custom domain, server-managed state, AI builder (Kitsy Mind), templates | $19-49/mo |
| **Business** | Multi-site, CRM, analytics, priority support, plugin marketplace | $99-199/mo |
| **Enterprise** | Self-hosted Kitsy Server (BSL), SLA, dedicated support, custom AI agents | Custom pricing |

---

## CRITICAL FILES (Starting Points)

- `packages/integrate/src/EventBus.ts` — Add `attachTransport()` (Phase 1)
- `packages/integrate/src/types.ts` — `$`-prefixed envelope keys (Phase 1)
- `packages/integrate/src/channels/index.ts` — Foundation for all RPC (all phases)
- `packages/navigate/src/NavigationStore.ts` — Adapter pattern template (Phase 1)
- `packages/app/src/@types/ApplicationConfiguration.ts` — Schema evolution + ViewNode (Phase 2-3)

---

## SUMMARY: THE KITSY ECOSYSTEM

```
┌─────────────────────────────────────────────────────────┐
│                    kitsy.ai (Platform)                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Studio   │  │   Mind   │  │ Platform │             │
│  │ (builder) │  │   (AI)   │  │ Services │             │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘             │
│        │              │              │                   │
│  ┌─────v──────────────v──────────────v─────┐            │
│  │            Kitsy Server                  │            │
│  │     (session, config, state, auth)       │            │
│  └─────────────────┬────────────────────────┘            │
│                    │                                     │
└────────────────────┼─────────────────────────────────────┘
                     │
    ═══════════════ BLU BUS (transport layer) ════════════
                     │
┌────────────────────┼─────────────────────────────────────┐
│                    │          Blu (Framework)             │
│  ┌─────────────────v──────────────────────┐              │
│  │  @kitsy/blu-bus — EventBus, Effects,  │              │
│  │  Channels, Commands (the universal     │              │
│  │  communication backbone)               │              │
│  └────────────────────────────────────────┘              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ blu-shell│ │ blu-style│ │  blu-ui  │ │blu-route │   │
│  │ blu-core │ │ blu-grid │ │blu-blocks│ │blu-contxt│   │
│  │ blu-icons│ │blu-tmplts│ │ blu-wire │ │ blu-sync │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Blu is the engine. Kitsy is the car.**

All under one roof: `@kitsy`.
