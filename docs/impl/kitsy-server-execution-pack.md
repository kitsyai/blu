# Kitsy Server — Execution Pack

**Track:** C (Kitsy Server)  
**Phase:** 2 (Starts Week 3, after Blu A1-A2 ship)  
**Owner:** Prashant + Codex agents  
**Repo:** `github.com/kitsy-ai/kitsy` → `packages/server/`  
**Spec Document:** Server Implementation Spec  
**Depends on:** `@kitsy/blu-bus` (A1), `@kitsy/blu-types` (A2), `@kitsy/blu-wire` (A8), `@kitsy/blu-shell/core` (A3)

---

## Scope Rule

> **This track builds the Kitsy Server — gateway, sessions, bus integration, config store, state sync, and publish pipeline. It does NOT build Studio embedding, AI agent effects, marketplace, or advanced platform features.**
>
> AI-related bus effects (`ai:*` handlers) are Phase 4 (Mind track). This track only provides the bus infrastructure that Mind will plug into later.

---

## 1. Sprint Plan

### Sprint C1 — Server Scaffold (Weeks 3-4)

**Objective:** Scaffold Node.js server with Hono, WebSocket, and local dev infrastructure.

**Ref:** Server Spec §3 (Package Structure), §4 (Gateway)

| # | Task |
|---|------|
| 1 | Create `packages/server/` in platform monorepo |
| 2 | Set up Hono HTTP framework with TypeScript |
| 3 | Implement: `GET /health` → `{ status, version, uptime }`, `GET /ready` → `{ ready, checks }` |
| 4 | Set up WebSocket upgrade on `/ws` path (using `ws` or Hono WebSocket) |
| 5 | Create `docker-compose.yml`: kitsy-server + postgres:15 + redis:7 |
| 6 | Implement typed server configuration (from Server Spec §19): env vars with `KITSY_` prefix |
| 7 | Set up vitest for testing |
| 8 | Implement graceful shutdown: close WS connections, drain HTTP, disconnect DB/Redis |

**Exit criteria:**
- [ ] `docker compose up` starts server + postgres + redis
- [ ] `GET /health` returns 200 with version and uptime
- [ ] WebSocket upgrade succeeds on `/ws`
- [ ] Config loads from `KITSY_*` environment variables
- [ ] Graceful shutdown closes connections cleanly

**DO NOT:** Implement auth, bus, or config store.

---

### Sprint C2 — Auth & Sessions (Weeks 5-6)

**Objective:** JWT validation, session lifecycle, and handshake protocol.

**Ref:** Server Spec §5 (Sessions), §6 (Auth)

| # | Task |
|---|------|
| 1 | Implement JWT verification (Supabase JWT or standalone with configurable secret/JWKS) |
| 2 | Define Session entity (from Server Spec §5.1): sessionId, tenantId, userId, siteId, transport, configVersion, timestamps |
| 3 | Implement SessionManager: create, destroy, get, getByTenant, getBySite, broadcastToTenant, broadcastToSite, sendToSession, sweepStale |
| 4 | Implement WebSocket handshake flow: client sends `{ type: "handshake", token, siteId, configVersion }` → server validates JWT → creates session → responds with `{ type: "handshake:ack", sessionId, configVersion, serverTime }` |
| 5 | Implement heartbeat: server sends ping every 30s, client must pong within 10s, 3 missed → disconnect |
| 6 | Session cleanup: remove on disconnect, sweepStale timer |
| 7 | Auth middleware function (for bus pipeline in C3): validates `$auth`, enriches command meta with `$tenantId`, `$userId`, `$roles`, `$scopes` |

**Exit criteria:**
- [ ] Client connects via WS, sends handshake with valid JWT → receives sessionId
- [ ] Invalid JWT → connection rejected with error
- [ ] Expired JWT → connection rejected
- [ ] Session created on handshake, destroyed on disconnect
- [ ] Heartbeat timeout disconnects stale clients
- [ ] `SessionManager.getByTenant()` returns only same-tenant sessions

**DO NOT:** Implement bus routing or config store. Auth middleware is defined but wired in C3.

---

### Sprint C3 — Bus Integration (Weeks 7-8)

**Objective:** Server-side Blu EventBus with command routing and tenant isolation.

**Ref:** Server Spec §7 (Router), §11 (Tenant Isolation)  
**Depends on:** A1 (`@kitsy/blu-bus` published), C2 (sessions + auth middleware)

| # | Task |
|---|------|
| 1 | Import `@kitsy/blu-bus` — create server-side EventBus instance |
| 2 | Implement CommandRouter: route by `$destination` → "server" (local), "browser:{id}" (specific session), "tenant:*" (broadcast), "*" (all) |
| 3 | Implement `$hop` increment and `$ttl` check (discard if exceeded) |
| 4 | Wire tenant middleware: tag commands with `$tenantId`, reject cross-tenant destinations |
| 5 | Wire rate limiting: per-session commands/second, per-tenant commands/minute (from plan limits) |
| 6 | Wire audit middleware: structured log to stdout (timestamp, tenantId, sessionId, type, destination) |
| 7 | Wire middleware pipeline in order: auth → tenant → rate-limit → audit → route |
| 8 | Bridge WebSocket ↔ bus: WS message → deserialize → middleware → deliver; bus command targeting session → serialize → WS send |
| 9 | Test: two browser clients connect, command from A reaches B via server relay |

**Exit criteria:**
- [ ] Server bus receives commands from WebSocket clients
- [ ] `$destination` routing works for all patterns (server, browser:id, tenant:*, *)
- [ ] Cross-tenant command rejected
- [ ] Rate limit triggers and returns error
- [ ] All commands logged to structured stdout
- [ ] Two browsers exchange commands through server

**DO NOT:** Implement config store, state sync, or AI effects.

---

### Sprint C4 — Config Store (Weeks 9-10)

**Objective:** Versioned ApplicationConfiguration CRUD with JSON Patch diffing.

**Ref:** Server Spec §8 (Config Store), §16 (DB Schema)

| # | Task |
|---|------|
| 1 | Create `configs` and `config_versions` tables (from Server Spec §8.2 SQL schema) |
| 2 | Implement ConfigStore interface: get, getAtVersion, save, diff, history, rollback |
| 3 | Save flow: validate config → load current → compute JSON Patch diff → increment version → compute SHA-256 checksum → transaction: INSERT version + UPDATE config |
| 4 | Snapshot policy: store full config snapshot every 10th version |
| 5 | Diff: reconstruct any version by applying patches from nearest snapshot |
| 6 | Rollback: load target version (from snapshot + patches) → save as new version |
| 7 | History: return version entries with timestamps, authors, patch sizes |
| 8 | REST endpoints: `GET /api/v1/configs/:siteId`, `POST /api/v1/configs/:siteId`, `GET /api/v1/configs/:siteId/versions`, `POST /api/v1/configs/:siteId/rollback` |
| 9 | Migration chain: if config `$version` < LATEST, run migration functions before serving |

**Exit criteria:**
- [ ] Config saved with version increment and checksum
- [ ] JSON Patch diff computed correctly between versions
- [ ] Rollback to any previous version works
- [ ] History returns ordered version entries
- [ ] REST API endpoints all functional
- [ ] Snapshots stored every 10th version
- [ ] All queries scoped by tenant_id

**DO NOT:** Implement config sync protocol (that's C5). Don't implement AI validation.

---

### Sprint C5 — Config Sync Protocol (Weeks 10-11)

**Objective:** Real-time config synchronization between server and connected browsers.

**Ref:** Server Spec §10 (Sync Protocol)  
**Depends on:** C3 (bus), C4 (config store), A8 (`@kitsy/blu-wire` WebSocketTransport)

| # | Task |
|---|------|
| 1 | Create `@kitsy/blu-sync` client package: SyncManager, ConfigSync, OfflineQueue, PatchApplier |
| 2 | Create `@kitsy/protocol` types package: Envelope, SyncMessage, HandshakeMessage, etc. |
| 3 | Initial sync on connect: client sends configVersion in handshake → server sends full config (if client has none) or delta patch (if client is behind) |
| 4 | Server push: when config saved (via API or another client), compute patch from previous version, broadcast `sync:config` to all site sessions |
| 5 | Client ack: client sends `sync:config:ack` with acknowledged version |
| 6 | Client propose: client sends `sync:config:propose` with patch → server validates → accepts (apply + broadcast) or rejects (send reason + current version) |
| 7 | OfflineQueue: client queues commands during disconnect, replays on reconnect with dedup via `$correlationId` |
| 8 | `render(config, { platform: "kitsy", endpoint: "wss://..." })` → auto-creates SyncManager + WebSocketTransport → syncs on connect |

**Exit criteria:**
- [ ] `@kitsy/blu-sync` and `@kitsy/protocol` published
- [ ] Client connects → receives full config or delta patch
- [ ] Config saved via API → all connected browsers receive push
- [ ] Client propose → server accepts/rejects
- [ ] Offline → reconnect → delta sync restores state
- [ ] `render(config, { platform: "kitsy" })` auto-syncs
- [ ] Two tabs editing same site see each other's changes

**DO NOT:** Implement state sync (C6), AI effects, or Studio integration.

---

### Sprint C6 — State Store (Weeks 11-12)

**Objective:** Per-session and shared state management with conflict resolution.

**Ref:** Server Spec §9 (State Store)

| # | Task |
|---|------|
| 1 | Implement StateStore with Redis adapter: get/set/delete per-session state, get/set shared state |
| 2 | Redis key structure: `state:{tenantId}:{siteId}:{sessionId}:{key}` (per-session, TTL), `state:{tenantId}:{siteId}:shared:{key}` (shared) |
| 3 | State versioning: monotonic version per key for conflict detection |
| 4 | Optimistic update flow: client writes → server validates expectedVersion → accept (broadcast) or conflict (send corrective) |
| 5 | Conflict resolution: last-writer-wins (default), configurable per-key via statePolicy |
| 6 | Bus commands: `sync:state:write` (client → server), `sync:state:ack` (server → client), `sync:state` (broadcast) |
| 7 | Client-side: extend `@kitsy/blu-sync` with StateSync |
| 8 | Session cleanup: clear per-session state on disconnect |

**Exit criteria:**
- [ ] Shared state write in browser A appears in browser B
- [ ] Version conflict detected and resolved (last-writer-wins)
- [ ] Per-session state isolated between sessions
- [ ] State cleared on session disconnect
- [ ] Redis TTL prevents stale data accumulation

**DO NOT:** Implement durable state persistence to PostgreSQL (that's Pro+ tier, later).

---

### Sprint C7 — Publish Pipeline (Weeks 12-13)

**Objective:** SSR build → CDN deploy → live site serving.

**Ref:** Blu Product Hosting §8 (Publish Pipeline)  
**Depends on:** A3 (`@kitsy/blu-shell/core` for SSR), C4 (config store)

| # | Task |
|---|------|
| 1 | Load latest config from ConfigStore |
| 2 | Validate config via `@kitsy/blu-validate` |
| 3 | Render each view via `renderToStringSSR()` → static HTML |
| 4 | Generate CSS via CssBuilder from theme tokens |
| 5 | Assemble bundle: HTML + CSS + inline config JSON + Blu CDN script tag |
| 6 | Upload bundle to Cloudflare R2: `/tenants/{tenantId}/sites/{siteId}/v{version}/` |
| 7 | Configure Cloudflare DNS: `{slug}.kitsy.ai` → R2 bucket |
| 8 | Record deployment in `deployments` table |
| 9 | REST endpoint: `POST /api/v1/publish/:siteId` → async pipeline → return deployment ID |
| 10 | Deployment status endpoint: `GET /api/v1/deployments/:deploymentId` |

**Exit criteria:**
- [ ] `POST /publish/:siteId` triggers build pipeline
- [ ] Site rendered as static HTML with Blu hydration
- [ ] Bundle uploaded to R2
- [ ] Site live at `{slug}.kitsy.ai`
- [ ] Deployment recorded with status, timing, bundle size
- [ ] Deployment status queryable

**DO NOT:** Implement custom domains (C8), server-managed mode (WSS hydration), or analytics injection.

---

### Sprint C8 — Billing & Domains (Weeks 13-14)

**Objective:** Stripe billing integration and custom domain support.

**Ref:** Blu Product Hosting §9 (Domains), §11 (Billing)

| # | Task |
|---|------|
| 1 | Stripe integration: createCustomer on tenant creation, create/update/cancel subscription |
| 2 | Stripe webhook handler: subscription.created, subscription.updated, subscription.deleted, invoice.paid, invoice.payment_failed |
| 3 | Plan enforcement middleware: check limits before site creation, AI requests, asset upload |
| 4 | Custom domain flow: add domain → store verification token → DNS check endpoint (polled by client) → SSL provisioning via Cloudflare |
| 5 | Domains table: id, tenant_id, site_id, domain, status, verification_token, ssl_status |
| 6 | Billing REST endpoints: `GET /billing`, `POST /billing/portal` (Stripe portal URL) |
| 7 | Domain REST endpoints: `POST /domains`, `GET /domains/:id/status`, `DELETE /domains/:id` |

**Exit criteria:**
- [ ] Stripe subscription created on plan upgrade
- [ ] Webhooks correctly update tenant plan/limits
- [ ] Plan limits enforced (site creation blocked at limit)
- [ ] Custom domain DNS verification works
- [ ] Site serves from custom domain with SSL
- [ ] Billing portal accessible

**DO NOT:** Implement domain registration (Namecheap, future). Don't build analytics, team management, or marketplace.

---

## 2. Phase 2 Gate

**ALL of these must be true:**
- [ ] Server runs: Hono + WebSocket + PostgreSQL + Redis
- [ ] JWT auth on every command
- [ ] Config store: save, get, diff, history, rollback
- [ ] Config sync: initial + push + ack + propose/accept/reject
- [ ] State sync: shared state with conflict resolution
- [ ] Publish: SSR → R2 → live at `*.kitsy.ai`
- [ ] Billing: Stripe integration, plan enforcement
- [ ] Domains: custom domain with DNS verification + SSL
- [ ] Tenant isolation verified end-to-end

---

## 3. Track Governance

### Code rules

```
Server code:
  - Hono for HTTP (NOT Express, NOT Fastify)
  - Import @kitsy/blu-bus directly (zero DOM deps — works in Node)
  - All bus effects must be idempotent (safe to replay)
  - All DB queries include tenant_id in WHERE
  - All Redis keys prefixed with tenant_id
  - All WebSocket messages validated against @kitsy/protocol types
  - Environment variables for config (12-factor, KITSY_ prefix)
  - Docker Compose for local dev
  - vitest for testing
```

### Dependency rules

```
ALLOWED:
  @kitsy/server → @kitsy/blu-bus, @kitsy/blu-types, @kitsy/blu-validate, @kitsy/blu-shell/core (SSR)
  @kitsy/server → hono, ws, pg, ioredis, stripe
  @kitsy/protocol → @kitsy/blu-types (types only)
  @kitsy/blu-sync → @kitsy/blu-bus, @kitsy/blu-wire, @kitsy/protocol

NOT ALLOWED:
  @kitsy/server → @kitsy/studio, @kitsy/mind, @kitsy/canvas
  @kitsy/server → React, ReactDOM (server is headless except SSR)
  @kitsy/blu-sync → @kitsy/server (client package must not import server)
```

### Bus governance (server-side)

```
Server bus middleware order: auth → tenant → rate-limit → audit → route
Server effects handle: sync:config:*, sync:state:*, platform:* commands
Server does NOT handle: ai:* commands (that's Mind track, Phase 4)
Server does NOT handle: studio:* commands (that's Studio track, Phase 4)
```

### Sprint handoff template

```markdown
## Sprint C{N} Complete

### What shipped
- Endpoints: [list REST + WS commands]
- Tables: [created/modified]
- Packages: [@kitsy/protocol, @kitsy/blu-sync if applicable]

### Exit criteria
- [ ] Criterion: [evidence]

### Infrastructure state
- Docker compose: [services running]
- DB migrations: [list applied]
- Redis keys: [patterns used]

### What next sprint needs
- [API contracts, sync protocol state, deployed endpoints]
```
