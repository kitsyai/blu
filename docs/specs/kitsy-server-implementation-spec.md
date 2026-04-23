# Kitsy Server — Implementation Specification

**Status:** Canonical — implementation specification for Kitsy Server
**Scope:** Phase 2 deliverable — `@kitsy/server`, `@kitsy/protocol`, `@kitsy/blu-sync`
**Runtime:** Node.js (migration path to Bun when mature)
**License:** BSL (Business Source License)
**Read first:** `docs/blu/foundation.md`, `docs/blu/architecture.md`, `docs/blu/specification.md` (§1 BluEvent, §8 Bus API, §9 Transport contract, §17 Error semantics), `docs/blu/execution.md`

---

## Table of Contents

1. [Overview & Design Goals](#1-overview--design-goals)
2. [System Architecture](#2-system-architecture)
3. [Package Structure](#3-package-structure)
4. [Gateway Layer](#4-gateway-layer)
5. [Session Management](#5-session-management)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Command Router](#7-command-router)
8. [Config Store](#8-config-store)
9. [State Store](#9-state-store)
10. [Sync Protocol](#10-sync-protocol)
11. [Tenant Isolation](#11-tenant-isolation)
12. [AI Agent Integration](#12-ai-agent-integration)
13. [Platform Service Adapters](#13-platform-service-adapters)
14. [Deployment & Scaling](#14-deployment--scaling)
15. [Observability](#15-observability)
16. [Database Schema](#16-database-schema)
17. [API Surface](#17-api-surface)
18. [Error Taxonomy](#18-error-taxonomy)
19. [Configuration](#19-configuration)
20. [Implementation Sequence](#20-implementation-sequence)

---

## 1. Overview & Design Goals

Kitsy Server is a Node.js process that participates in the Blu EventBus as a first-class endpoint. It is not an HTTP API server with a bus bolted on — it IS a bus participant that also exposes HTTP/WebSocket interfaces for client connections.

### 1.1 Design goals

| Goal | Constraint |
|------|-----------|
| **Bus-native** | Server uses the same `@kitsy/blu-bus` package as the browser. Commands dispatched server-side use identical APIs. |
| **Isomorphic** | `blu-bus` has zero DOM deps. Server imports and uses it without polyfills. |
| **Stateless-first** | Session state is ephemeral in memory. Durable state lives in the database. A server restart loses WebSocket connections but not data. |
| **Horizontally scalable** | Multiple server instances behind a load balancer. Cross-instance communication via Redis pub/sub or NATS for command fan-out. |
| **Tenant-isolated** | Every data path is tenant-scoped. No shared state between tenants except explicit marketplace resources. |
| **Secure by default** | All commands require valid JWT. No anonymous server-side bus participation. Rate-limited per session and per tenant. |

### 1.2 What Kitsy Server is NOT

- Not a general-purpose API framework (use Express/Fastify/Hono for REST endpoints)
- Not a database (uses PostgreSQL/Supabase for persistence)
- Not a CDN or static file server (delegate to Cloudflare R2/S3+CloudFront)
- Not a monolith — platform services (billing, domains, email) are separate processes that communicate via REST or message queue, not the bus

---

## 2. System Architecture

```
                         Internet
                            │
                     ┌──────▼──────┐
                     │  Load       │
                     │  Balancer   │   (TLS termination, WebSocket upgrade)
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
        │  Server    │ │ Server   │ │ Server   │   (N horizontal instances)
        │  Instance  │ │ Instance │ │ Instance │
        └─────┬──────┘ └────┬─────┘ └────┬─────┘
              │             │             │
              └──────┬──────┴──────┬──────┘
                     │             │
              ┌──────▼──────┐ ┌───▼────────┐
              │  PostgreSQL │ │  Redis      │
              │  (Supabase) │ │  (pub/sub + │
              │             │ │   cache)    │
              └─────────────┘ └────────────┘


        ┌──────────────────────────────────────────┐
        │           Single Server Instance          │
        │                                          │
        │  ┌────────────┐                          │
        │  │  Gateway    │  HTTP + WebSocket        │
        │  │  (Hono)     │  ingress                 │
        │  └──────┬──────┘                          │
        │         │                                │
        │  ┌──────▼──────┐                          │
        │  │  Session     │  Connection pool,        │
        │  │  Manager     │  auth state              │
        │  └──────┬──────┘                          │
        │         │                                │
        │  ┌──────▼──────┐                          │
        │  │  Middleware  │  Auth → Tenant → Rate    │
        │  │  Pipeline    │  → Audit → Route         │
        │  └──────┬──────┘                          │
        │         │                                │
        │  ┌──────▼──────┐                          │
        │  │  Blu        │  Server-side EventBus    │
        │  │  EventBus   │  (same @kitsy/blu-bus)   │
        │  └──────┬──────┘                          │
        │         │                                │
        │  ┌──────┼──────┬──────────┐              │
        │  │      │      │          │              │
        │  │  ┌───▼──┐ ┌─▼────┐ ┌──▼───┐         │
        │  │  │Config│ │State │ │Effect│         │
        │  │  │Store │ │Store │ │Runner│         │
        │  │  └──────┘ └──────┘ └──────┘         │
        │  │                                      │
        │  │  ┌────────────────────────┐          │
        │  │  │  Cross-Instance Relay  │          │
        │  │  │  (Redis pub/sub)       │          │
        │  │  └────────────────────────┘          │
        │                                          │
        └──────────────────────────────────────────┘
```

---

## 3. Package Structure

### 3.1 `@kitsy/server` (BSL)

```
@kitsy/server/
├── src/
│   ├── gateway/
│   │   ├── http.ts              # REST endpoints (health, config upload, publish)
│   │   ├── websocket.ts         # WebSocket upgrade + connection lifecycle
│   │   └── sse.ts               # SSE fallback transport
│   ├── session/
│   │   ├── SessionManager.ts    # Connection pool, lifecycle
│   │   ├── Session.ts           # Individual session state
│   │   └── SessionStore.ts      # Interface for session persistence (memory default)
│   ├── middleware/
│   │   ├── auth.ts              # JWT validation, user extraction
│   │   ├── tenant.ts            # Tenant scoping, cross-tenant rejection
│   │   ├── rate-limit.ts        # Per-session and per-tenant rate limiting
│   │   ├── audit.ts             # Command logging for observability
│   │   └── pipeline.ts          # Middleware chain composition
│   ├── router/
│   │   ├── CommandRouter.ts     # $destination-based routing logic
│   │   ├── FanOut.ts            # Broadcast to tenant sessions
│   │   └── CrossInstanceRelay.ts # Redis pub/sub for multi-instance
│   ├── stores/
│   │   ├── ConfigStore.ts       # Versioned ApplicationConfiguration CRUD
│   │   ├── StateStore.ts        # Per-session state management
│   │   └── adapters/
│   │       ├── PostgresConfigAdapter.ts
│   │       ├── PostgresStateAdapter.ts
│   │       └── MemoryAdapter.ts  # For dev/testing
│   ├── effects/
│   │   ├── sync.effects.ts      # Config and state sync handlers
│   │   ├── ai.effects.ts        # AI agent request/response routing
│   │   └── platform.effects.ts  # Platform service integration effects
│   ├── server.ts                # Main entry: bootstrap, wire everything
│   └── config.ts                # Server configuration schema
├── tests/
├── Dockerfile
├── docker-compose.yml           # Server + Postgres + Redis for local dev
└── package.json
```

### 3.2 `@kitsy/protocol` (BSL)

Shared types used by both `@kitsy/server` and `@kitsy/blu-sync`:

```
@kitsy/protocol/
├── src/
│   ├── envelope.ts              # Envelope, SyncMessage, AckMessage
│   ├── sync.ts                  # SyncConfig, SyncState message types
│   ├── errors.ts                # Error codes and shapes
│   ├── session.ts               # Session handshake types
│   └── index.ts
└── package.json
```

### 3.3 `@kitsy/blu-sync` (Apache 2.0)

Client-side sync protocol — part of Blu open-source:

```
@kitsy/blu-sync/
├── src/
│   ├── SyncManager.ts           # Manages config + state sync lifecycle
│   ├── ConfigSync.ts            # Applies JSON Patch to local config
│   ├── StateSync.ts             # Optimistic updates, conflict detection
│   ├── OfflineQueue.ts          # Queues commands during disconnect
│   ├── PatchApplier.ts          # RFC 6902 JSON Patch application
│   └── index.ts
└── package.json
```

---

## 4. Gateway Layer

### 4.1 HTTP framework

**Choice: Hono** — lightweight, fast, works on Node.js/Bun/Cloudflare Workers (portability). Not Express (too heavy, not typed). Not Fastify (unnecessary complexity for this use case).

### 4.2 REST endpoints

These are NOT bus commands. They are standard HTTP for operations that don't need real-time:

```typescript
// Health & readiness
GET  /health                          → { status: "ok", version, uptime }
GET  /ready                           → { ready: boolean, checks: {...} }

// Config management (authenticated, tenant-scoped)
GET  /api/v1/configs                  → List configs for tenant
GET  /api/v1/configs/:siteId          → Get latest config
GET  /api/v1/configs/:siteId/versions → Version history
POST /api/v1/configs/:siteId          → Create/update config (returns version)
POST /api/v1/configs/:siteId/rollback → Rollback to version

// Publish pipeline (authenticated)
POST /api/v1/publish/:siteId          → Trigger SSR build + CDN deploy

// Admin / platform (internal, service-to-service auth)
GET  /api/v1/admin/sessions           → Active session count per tenant
GET  /api/v1/admin/metrics            → Prometheus-compatible metrics
```

### 4.3 WebSocket lifecycle

```typescript
// Connection handshake
// 1. Client connects to wss://rt.kitsy.ai/ws
// 2. Client sends first message: { type: "handshake", token: "<JWT>" }
// 3. Server validates JWT, extracts tenantId, userId
// 4. Server creates Session, assigns sessionId
// 5. Server responds: { type: "handshake:ack", sessionId, configVersion }
// 6. If client's configVersion < server's, server sends config patch
// 7. Connection is now bus-active

interface HandshakeMessage {
  type: "handshake";
  token: string;                       // JWT
  siteId: string;                      // Which site/app
  configVersion?: number;              // Client's current config version (0 = fresh)
  capabilities?: string[];             // ["sync:config", "sync:state", "ai"]
}

interface HandshakeAck {
  type: "handshake:ack";
  sessionId: string;
  configVersion: number;               // Server's current version
  serverTime: number;                  // For clock skew estimation
  config?: ApplicationConfiguration;   // Full config if client has none
  patch?: JSONPatch[];                 // Delta if client is behind
}

// Heartbeat
// Server sends ping every 30s
// Client must respond with pong within 10s
// 3 missed pongs = disconnect

// Reconnection (client-side, handled by @kitsy/blu-wire WebSocketTransport)
// 1. Exponential backoff: 1s, 2s, 4s, 8s, max 30s
// 2. On reconnect: repeat handshake with last known configVersion
// 3. Server sends delta patch
// 4. Client replays queued commands (dedup via $correlationId)
```

### 4.4 SSE fallback

For environments where WebSocket is blocked (corporate firewalls, some proxies):

```
// Server → Client: SSE stream
GET /sse?token=<JWT>&siteId=<id>&configVersion=<n>
  → event: command
    data: { type, target, payload, meta }
  → event: heartbeat
    data: { serverTime }

// Client → Server: HTTP POST per command
POST /sse/send
  Authorization: Bearer <JWT>
  Body: { type, target, payload, meta }
```

---

## 5. Session Management

### 5.1 Session entity

```typescript
interface Session {
  // Identity
  sessionId: string;                   // UUID v4, assigned by server
  tenantId: string;                    // From JWT claims
  userId: string;                      // From JWT claims
  siteId: string;                      // From handshake

  // Connection
  transport: ServerTransport;          // WebSocket or SSE connection handle
  transportType: "websocket" | "sse";
  connectedAt: number;                 // Epoch ms
  lastActivityAt: number;              // Updated on every command
  lastPingAt: number;                  // Last heartbeat sent
  missedPongs: number;                 // 3 = disconnect

  // Sync state
  configVersion: number;               // Client's acknowledged config version
  stateVersion: number;                // Client's acknowledged state version
  capabilities: Set<string>;           // Negotiated in handshake

  // Rate limiting
  commandCount: number;                // Commands in current window
  windowStart: number;                 // Rate limit window start
}
```

### 5.2 SessionManager

```typescript
interface SessionManager {
  // Lifecycle
  create(handshake: HandshakeMessage, transport: ServerTransport): Promise<Session>;
  destroy(sessionId: string, reason: DisconnectReason): void;
  get(sessionId: string): Session | undefined;

  // Queries (tenant-scoped)
  getByTenant(tenantId: string): Session[];
  getBySite(tenantId: string, siteId: string): Session[];
  getByUser(tenantId: string, userId: string): Session[];

  // Broadcast
  broadcastToTenant(tenantId: string, command: Command): void;
  broadcastToSite(tenantId: string, siteId: string, command: Command): void;
  sendToSession(sessionId: string, command: Command): void;

  // Stats
  sessionCount(): number;
  sessionCountByTenant(tenantId: string): number;

  // Cleanup
  sweepStale(maxInactiveMs: number): number; // Returns count of cleaned sessions
}
```

### 5.3 Session storage

**Default: In-memory Map.** Sessions are ephemeral — they exist only while the WebSocket is connected. No database persistence needed.

**For multi-instance:** Session metadata (sessionId → instanceId mapping) is stored in Redis with TTL matching the session timeout. This allows the cross-instance relay to route commands to the correct server instance.

```typescript
// Redis key structure for sessions
SET  session:{sessionId}  → { instanceId, tenantId, siteId, userId }  TTL 3600
SET  tenant:{tenantId}:sessions → Set<sessionId>                      TTL 3600
```

---

## 6. Authentication & Authorization

### 6.1 JWT structure

```typescript
interface KitsyJWTPayload {
  // Standard claims
  sub: string;                         // userId
  iss: "kitsy.ai";
  aud: "kitsy-server";
  exp: number;                         // Expiration (15 min from issue)
  iat: number;                         // Issued at
  jti: string;                         // Unique token ID (for blacklisting)

  // Kitsy claims
  tid: string;                         // tenantId
  roles: string[];                     // ["owner", "editor", "viewer"]
  plan: string;                        // "starter", "pro", "business", "enterprise"
  scopes: string[];                    // ["site:read", "site:write", "ai:generate", "state:write"]
}
```

### 6.2 Auth middleware

```typescript
// Runs on EVERY command entering the server
async function authMiddleware(command: Command, next: Next): Promise<void> {
  const token = command.meta?.$auth;
  if (!token) throw new AuthError("MISSING_TOKEN");

  const payload = await verifyJWT(token);
  if (!payload) throw new AuthError("INVALID_TOKEN");

  if (payload.exp * 1000 < Date.now()) throw new AuthError("EXPIRED_TOKEN");

  // Check blacklist (for logout/revocation)
  if (await isTokenBlacklisted(payload.jti)) throw new AuthError("REVOKED_TOKEN");

  // Enrich command meta with verified identity
  command.meta.$tenantId = payload.tid;
  command.meta.$userId = payload.sub;
  command.meta.$roles = payload.roles;
  command.meta.$plan = payload.plan;
  command.meta.$scopes = payload.scopes;

  // Strip $auth before forwarding to other clients (security)
  const forwardCommand = { ...command, meta: { ...command.meta, $auth: undefined } };

  await next(forwardCommand);
}
```

### 6.3 Authorization model

```typescript
// Permission checks based on command type and user scopes
const COMMAND_SCOPES: Record<string, string[]> = {
  "sync:config:write":  ["site:write"],
  "sync:config:read":   ["site:read"],
  "sync:state:write":   ["state:write"],
  "sync:state:read":    ["site:read"],
  "ai:generate-site":   ["ai:generate"],
  "ai:edit-section":    ["ai:generate", "site:write"],
  "publish":            ["site:publish"],
  "config:rollback":    ["site:write"],
};

async function authzMiddleware(command: Command, next: Next): Promise<void> {
  const requiredScopes = COMMAND_SCOPES[command.type];
  if (!requiredScopes) {
    await next(command);  // Unknown commands pass through (extensibility)
    return;
  }

  const userScopes = command.meta.$scopes || [];
  const hasScope = requiredScopes.some(s => userScopes.includes(s));
  if (!hasScope) throw new AuthError("INSUFFICIENT_SCOPE", { required: requiredScopes });

  await next(command);
}
```

### 6.4 Token refresh flow

```
1. Client JWT expires in < 2 minutes
2. Client sends bus command: { type: "auth:refresh", payload: { refreshToken } }
3. Server validates refresh token (long-lived, stored in DB, one-time-use)
4. Server issues new JWT + new refresh token
5. Server responds: { type: "auth:refreshed", payload: { token, refreshToken, expiresAt } }
6. Client updates $auth on subsequent commands
7. Old refresh token is invalidated (rotation)
```

---

## 7. Command Router

### 7.1 Routing logic

```typescript
class CommandRouter {
  async route(command: Command, session: Session): Promise<void> {
    const dest = command.meta?.$destination;

    // Increment hop counter, check TTL
    const hop = (command.meta?.$hop || 0) + 1;
    if (command.meta?.$ttl && hop > command.meta.$ttl) {
      return; // TTL exceeded, discard silently
    }
    command.meta.$hop = hop;

    if (!dest || dest === "*") {
      // Broadcast: deliver to server bus + all tenant sessions (except sender)
      await this.deliverToServerBus(command);
      await this.broadcastToTenantSessions(command, session);
    } else if (dest === "server") {
      // Server-targeted: deliver only to server bus
      await this.deliverToServerBus(command);
    } else if (dest.startsWith("browser:")) {
      // Specific session: route to that session
      const targetSessionId = dest.replace("browser:", "");
      await this.sendToSession(targetSessionId, command);
    } else if (dest.startsWith("tenant:")) {
      // Tenant broadcast (includes cross-instance relay)
      await this.broadcastToTenantSessions(command, session);
    } else if (dest.startsWith("ai:")) {
      // AI agent: route to AI effect handlers
      await this.deliverToServerBus(command);
    } else {
      // Unknown destination: deliver to server bus (effects may handle it)
      await this.deliverToServerBus(command);
    }
  }

  private async broadcastToTenantSessions(command: Command, sender: Session): Promise<void> {
    const tenantId = command.meta.$tenantId;
    const sessions = this.sessionManager.getByTenant(tenantId);

    for (const target of sessions) {
      if (target.sessionId === sender.sessionId) continue; // Don't echo back to sender
      target.transport.send(command);
    }

    // Relay to other server instances via Redis pub/sub
    await this.crossInstanceRelay.publish(tenantId, command, sender.sessionId);
  }
}
```

### 7.2 Cross-instance relay (Redis pub/sub)

```typescript
class CrossInstanceRelay {
  private instanceId = crypto.randomUUID();
  private redis: Redis;

  async publish(tenantId: string, command: Command, excludeSessionId: string): Promise<void> {
    await this.redis.publish(`tenant:${tenantId}`, JSON.stringify({
      instanceId: this.instanceId,        // So receiving instances skip re-publish
      excludeSessionId,
      command,
    }));
  }

  subscribe(): void {
    // Subscribe to all tenant channels this instance has sessions for
    // On message: deliver to local sessions (excluding sender)
    this.redis.psubscribe("tenant:*", (channel, message) => {
      const { instanceId, excludeSessionId, command } = JSON.parse(message);
      if (instanceId === this.instanceId) return; // Skip own messages

      const tenantId = channel.replace("tenant:", "");
      const sessions = this.sessionManager.getByTenant(tenantId);
      for (const session of sessions) {
        if (session.sessionId === excludeSessionId) continue;
        session.transport.send(command);
      }
    });
  }
}
```

---

## 8. Config Store

### 8.1 Interface

```typescript
interface ConfigStore {
  // CRUD
  get(tenantId: string, siteId: string): Promise<VersionedConfig | null>;
  getAtVersion(tenantId: string, siteId: string, version: number): Promise<VersionedConfig | null>;
  save(tenantId: string, siteId: string, config: ApplicationConfiguration, userId: string): Promise<VersionedConfig>;

  // Diffing
  diff(tenantId: string, siteId: string, fromVersion: number, toVersion: number): Promise<JSONPatch[]>;

  // History
  history(tenantId: string, siteId: string, limit: number, offset?: number): Promise<VersionEntry[]>;

  // Rollback
  rollback(tenantId: string, siteId: string, toVersion: number, userId: string): Promise<VersionedConfig>;

  // Validation
  validate(config: ApplicationConfiguration): ValidationResult;
}

interface VersionedConfig {
  config: ApplicationConfiguration;
  version: number;
  tenantId: string;
  siteId: string;
  updatedBy: string;
  updatedAt: number;
  checksum: string;                    // SHA-256 of serialized config (integrity check)
}

interface VersionEntry {
  version: number;
  updatedBy: string;
  updatedAt: number;
  checksum: string;
  patchSize: number;                   // Bytes of the diff from previous version
  message?: string;                    // Optional commit message (from Studio or API)
}
```

### 8.2 Storage strategy

**PostgreSQL with JSONB:**

- Current version stored as JSONB column (fast reads)
- Version history stored as JSON Patch diffs (space-efficient)
- Full snapshots every N versions for fast rollback without replaying all patches

```sql
-- configs: current state
CREATE TABLE configs (
  tenant_id    TEXT NOT NULL,
  site_id      TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  config       JSONB NOT NULL,
  checksum     TEXT NOT NULL,
  updated_by   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, site_id)
);

-- config_versions: version history as diffs
CREATE TABLE config_versions (
  tenant_id    TEXT NOT NULL,
  site_id      TEXT NOT NULL,
  version      INTEGER NOT NULL,
  patch        JSONB NOT NULL,           -- JSON Patch (RFC 6902) from previous version
  snapshot     JSONB,                     -- Full config snapshot (every 10th version)
  checksum     TEXT NOT NULL,
  updated_by   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message      TEXT,
  PRIMARY KEY (tenant_id, site_id, version)
);

-- Index for fast history queries
CREATE INDEX idx_config_versions_lookup 
  ON config_versions (tenant_id, site_id, version DESC);
```

### 8.3 Save flow

```
1. Receive new config from client or API
2. Validate against JSON Schema (@kitsy/blu-validate)
3. Run migration chain if $version < LATEST_VERSION
4. Load current config from DB
5. Compute JSON Patch diff (current → new)
6. Increment version
7. Compute SHA-256 checksum
8. In transaction:
   a. INSERT into config_versions (diff + optional snapshot)
   b. UPDATE configs (new config, new version)
9. Broadcast to all site sessions: { type: "sync:config", payload: { version, patch } }
```

### 8.4 Snapshot policy

Full config snapshots are stored every 10 versions. This means:
- Rollback to version N requires replaying at most 9 patches from the nearest snapshot
- Storage cost: ~10% overhead vs. diff-only storage
- Configurable per-plan: Free=every 10, Pro=every 5, Enterprise=every version

---

## 9. State Store

### 9.1 Interface

```typescript
interface StateStore {
  // Per-session state
  get(tenantId: string, siteId: string, sessionId: string, key: string): Promise<StateEntry | null>;
  set(tenantId: string, siteId: string, sessionId: string, key: string, value: unknown, expectedVersion?: number): Promise<StateEntry>;
  delete(tenantId: string, siteId: string, sessionId: string, key: string): Promise<void>;
  getAll(tenantId: string, siteId: string, sessionId: string): Promise<Record<string, StateEntry>>;

  // Shared state (across all sessions for a site)
  getShared(tenantId: string, siteId: string, key: string): Promise<StateEntry | null>;
  setShared(tenantId: string, siteId: string, key: string, value: unknown, expectedVersion?: number): Promise<StateEntry>;

  // Cleanup
  clearSession(tenantId: string, siteId: string, sessionId: string): Promise<void>;
}

interface StateEntry {
  key: string;
  value: unknown;
  version: number;                     // Monotonic, for conflict detection
  updatedBy: string;                   // sessionId or "server"
  updatedAt: number;
}
```

### 9.2 Storage strategy

**Redis for hot state:**
- Per-session state: `state:{tenantId}:{siteId}:{sessionId}:{key}` with TTL = session timeout
- Shared state: `state:{tenantId}:{siteId}:shared:{key}` with TTL = configurable per plan

**PostgreSQL for durable shared state (Pro+ plans):**
- Shared state that must survive server restarts
- Write-through: write to Redis + async write to Postgres

### 9.3 Conflict resolution

```typescript
async function handleStateWrite(
  session: Session,
  key: string,
  value: unknown,
  expectedVersion?: number
): Promise<StateEntry> {
  const current = await stateStore.getShared(session.tenantId, session.siteId, key);

  if (expectedVersion !== undefined && current && current.version !== expectedVersion) {
    // Conflict detected
    // Default: last-writer-wins (overwrite)
    // Configurable per-key via config.statePolicy[key].conflictResolution

    const policy = getConflictPolicy(session.tenantId, session.siteId, key);

    switch (policy) {
      case "last-writer-wins":
        // Proceed with write, notify other sessions of the new value
        break;
      case "reject":
        // Reject the write, send corrective value to the writer
        session.transport.send({
          type: "sync:state",
          payload: { key, value: current.value, version: current.version, conflict: true }
        });
        return current;
      case "merge":
        // Application-specific merge function (registered per key pattern)
        const merged = await mergeFunction(current.value, value);
        value = merged;
        break;
    }
  }

  const entry = await stateStore.setShared(
    session.tenantId, session.siteId, key, value
  );

  // Broadcast new state to all site sessions
  sessionManager.broadcastToSite(session.tenantId, session.siteId, {
    type: "sync:state",
    target: key,
    payload: { key, value: entry.value, version: entry.version },
    meta: { $source: "server", $destination: "tenant:*" }
  });

  return entry;
}
```

---

## 10. Sync Protocol

### 10.1 Config sync

```
── Initial Connect ──────────────────────────────────

  Client                           Server
    │                                │
    │── handshake { configVersion: 3 } ──▶│
    │                                │ (server version = 5)
    │◀── handshake:ack { version: 5, patch: [v3→v5 diff] } ──│
    │                                │
    │── { type: "sync:config:ack", payload: { version: 5 } } ──▶│
    │                                │

── Server-initiated update ──────────────────────────

  Client                           Server
    │                                │ (config saved via API/Studio → v6)
    │◀── { type: "sync:config", payload: { version: 6, patch: [...] } } ──│
    │                                │
    │── { type: "sync:config:ack", payload: { version: 6 } } ──▶│
    │                                │

── Client-initiated update (Studio editing) ─────────

  Client                           Server
    │── { type: "sync:config:propose", payload: { patch: [...] } } ──▶│
    │                                │ (server validates, applies, increments version)
    │◀── { type: "sync:config:accepted", payload: { version: 7, patch: [...] } } ──│
    │                                │
    │ OR if validation fails:        │
    │◀── { type: "sync:config:rejected", payload: { reason, currentVersion: 6 } } ──│
    │                                │
```

### 10.2 State sync

```
── Optimistic update from client ────────────────────

  Client                           Server
    │ (user clicks "Add to Cart")    │
    │ (client applies optimistically)│
    │                                │
    │── { type: "sync:state:write",  │
    │    payload: {                  │
    │      key: "cart.items",        │
    │      value: [...],             │
    │      expectedVersion: 4        │
    │    }                           │
    │  } ──────────────────────────▶│
    │                                │ (server validates, accepts)
    │◀── { type: "sync:state:ack",   │
    │    payload: {                  │
    │      key: "cart.items",        │
    │      version: 5                │
    │    }                           │
    │  } ──────────────────────────│
    │                                │

── Conflict ─────────────────────────────────────────

  Client A                         Server                    Client B
    │                                │                          │
    │── write cart v4 ──────────────▶│                          │
    │                                │◀── write cart v4 ────────│
    │                                │                          │
    │                                │ (A arrives first, accepted as v5)
    │◀── ack v5 ─────────────────────│                          │
    │                                │ (B conflicts: expected v4, now v5)
    │                                │── conflict { key, value: A's value, v5 } ──▶│
    │                                │                          │ (B reapplies with v5)
```

### 10.3 Offline queue (client-side, `@kitsy/blu-sync`)

```typescript
class OfflineQueue {
  private queue: Command[] = [];
  private maxSize = 1000;

  enqueue(command: Command): void {
    if (this.queue.length >= this.maxSize) {
      // FIFO eviction: drop oldest non-critical commands
      const idx = this.queue.findIndex(c => !this.isCritical(c));
      if (idx >= 0) this.queue.splice(idx, 1);
    }
    this.queue.push(command);
  }

  async replay(transport: Transport): Promise<void> {
    const seen = new Set<string>();

    for (const command of this.queue) {
      // Dedup via $correlationId
      const cid = command.meta?.$correlationId;
      if (cid && seen.has(cid)) continue;
      if (cid) seen.add(cid);

      await transport.send(command);
    }

    this.queue = [];
  }

  private isCritical(command: Command): boolean {
    // Mutations and form submissions are critical; navigate/read commands are not
    return ["mutate", "form:submit", "sync:state:write"].includes(command.type);
  }
}
```

---

## 11. Tenant Isolation

### 11.1 Isolation enforcement points

```
┌──────────────────────────────────────────────────────────┐
│  TENANT ISOLATION — DEFENSE IN DEPTH                     │
│                                                          │
│  Layer 1: JWT Claims                                     │
│  ────────────────                                        │
│  tenantId extracted from verified JWT. Cannot be forged. │
│                                                          │
│  Layer 2: Middleware Pipeline                             │
│  ────────────────────────                                │
│  Every command tagged with $tenantId.                     │
│  Cross-tenant $destination silently dropped.              │
│                                                          │
│  Layer 3: Session Manager                                │
│  ─────────────────────                                   │
│  getByTenant() returns only same-tenant sessions.        │
│  broadcastToTenant() scoped by tenantId.                 │
│                                                          │
│  Layer 4: Config Store                                   │
│  ──────────────────                                      │
│  All queries include tenantId in WHERE clause.           │
│  No API to read cross-tenant configs.                    │
│                                                          │
│  Layer 5: State Store                                    │
│  ─────────────────                                       │
│  Redis keys prefixed with tenantId.                      │
│  No wildcard scan across tenant prefixes.                │
│                                                          │
│  Layer 6: Asset Store                                    │
│  ─────────────────                                       │
│  S3/R2 bucket paths prefixed with tenantId/.             │
│  IAM/presigned URLs scoped to tenant prefix.             │
│                                                          │
│  Layer 7: Redis Pub/Sub                                  │
│  ─────────────────────                                   │
│  Channels are tenant:{tenantId}. No cross-tenant         │
│  subscription possible.                                  │
│                                                          │
│  PRINCIPLE: A bug in any single layer does NOT           │
│  expose cross-tenant data because other layers           │
│  independently enforce isolation.                        │
└──────────────────────────────────────────────────────────┘
```

### 11.2 Rate limiting per tenant

```typescript
interface RateLimitConfig {
  commandsPerSecond: number;
  commandsPerMinute: number;
  connectionsPerTenant: number;
  configSavesPerHour: number;
  aiRequestsPerHour: number;
}

const PLAN_LIMITS: Record<string, RateLimitConfig> = {
  starter:    { commandsPerSecond: 50,  commandsPerMinute: 1000, connectionsPerTenant: 10,   configSavesPerHour: 30,  aiRequestsPerHour: 10  },
  pro:        { commandsPerSecond: 200, commandsPerMinute: 5000, connectionsPerTenant: 100,  configSavesPerHour: 120, aiRequestsPerHour: 100 },
  business:   { commandsPerSecond: 500, commandsPerMinute: 15000, connectionsPerTenant: 500, configSavesPerHour: 500, aiRequestsPerHour: 500 },
  enterprise: { commandsPerSecond: 2000, commandsPerMinute: 50000, connectionsPerTenant: 5000, configSavesPerHour: 2000, aiRequestsPerHour: 2000 },
};
```

---

## 12. AI Agent Integration

### 12.1 AI agent as bus participant

AI agents connect to the server-side EventBus as effects handlers, not as external HTTP services.

```typescript
// In server bootstrap
const aiEffect = createAIEffect({
  llmGateway: new LLMGateway({ providers: ["anthropic", "openai"] }),
  promptEngine: new PromptEngine({ templates: loadPromptTemplates() }),
  validator: new ConfigValidator(),
  registry: componentRegistry,
});

// Register effects on the server bus
bus.effects.onEvery("ai:generate-site", aiEffect.handleGenerateSite);
bus.effects.onEvery("ai:edit-section", aiEffect.handleEditSection);
bus.effects.onEvery("ai:suggest-theme", aiEffect.handleSuggestTheme);
bus.effects.onEvery("ai:write-copy", aiEffect.handleWriteCopy);
bus.effects.onEvery("ai:generate-form", aiEffect.handleGenerateForm);
```

### 12.2 AI request/response flow

```typescript
async function handleGenerateSite(command: Command, { bus, channels }: EffectContext): Promise<void> {
  const { prompt, availableComponents, themeTokens } = command.payload;
  const correlationId = command.meta.$correlationId;

  try {
    // 1. Build LLM prompt with schema, URN catalog, and few-shot examples
    const llmPrompt = promptEngine.buildSitePrompt({
      userPrompt: prompt,
      componentCatalog: availableComponents.map(urn => registry.getMeta(urn)),
      themeTokens,
      schema: ApplicationConfigurationJSONSchema,
    });

    // 2. Call LLM
    const raw = await llmGateway.generate(llmPrompt, {
      model: "claude-sonnet-4-20250514",
      maxTokens: 8000,
      temperature: 0.7,
    });

    // 3. Parse response
    const config = JSON.parse(extractJSON(raw));

    // 4. Validate envelope and payload via @kitsy/blu-validate (see docs/blu/specification.md §1 envelope, §17 error semantics)
    const validation = validator.fullPipeline(config, componentRegistry);
    if (!validation.valid) {
      // Attempt auto-fix for common issues
      const fixed = validator.autoFix(config, validation.errors);
      if (!fixed.valid) {
        channels.answer(correlationId, { success: false, errors: fixed.errors });
        return;
      }
      config = fixed.config;
    }

    // 5. Respond via bus
    channels.answer(correlationId, { success: true, config });

  } catch (error) {
    channels.answer(correlationId, { success: false, error: error.message });
  }
}
```

### 12.3 AI safety guardrails

```typescript
class ConfigValidator {
  fullPipeline(config: unknown, registry: ComponentRegistry): ValidationResult {
    const errors: ValidationError[] = [];

    // Step 1: JSON Schema
    errors.push(...this.schemaValidation(config));
    if (errors.length > 0) return { valid: false, errors }; // Fail fast on structure

    // Step 2: URN resolution
    for (const node of walkViewNodes(config)) {
      if (!registry.has(node.componentUrn)) {
        errors.push({ path: `${node.id}.componentUrn`, message: `Unknown URN: ${node.componentUrn}` });
      }
    }

    // Step 3: Data source references
    const sourceIds = new Set((config.dataSources || []).map(ds => ds.id));
    for (const node of walkViewNodes(config)) {
      if (node.data?.source && !sourceIds.has(node.data.source)) {
        errors.push({ path: `${node.id}.data.source`, message: `Unknown data source: ${node.data.source}` });
      }
    }

    // Step 4: Action targets
    for (const node of walkViewNodes(config)) {
      if (node.actions) {
        for (const [event, action] of Object.entries(node.actions)) {
          errors.push(...this.validateAction(action, sourceIds, config));
        }
      }
    }

    // Step 5: Circular references
    errors.push(...this.checkCircularRefs(config));

    // Step 6: Render smoke test (headless)
    // Deferred to async — not blocking validation response

    // Step 7: Accessibility baseline
    errors.push(...this.checkAccessibility(config));

    return { valid: errors.length === 0, errors };
  }
}
```

---

## 13. Platform Service Adapters

Platform services (billing, domains, email) are NOT bus participants. They are called by Kitsy Server via REST/SDK adapters.

```typescript
// Server-side platform service interfaces

interface BillingAdapter {
  createCustomer(tenantId: string, email: string): Promise<CustomerId>;
  createSubscription(customerId: string, planId: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getUsage(tenantId: string): Promise<UsageReport>;
}

interface DomainAdapter {
  checkAvailability(domain: string): Promise<{ available: boolean; price: number }>;
  register(tenantId: string, domain: string, years: number): Promise<DomainRegistration>;
  configureDNS(domain: string, records: DNSRecord[]): Promise<void>;
}

interface EmailAdapter {
  send(to: string, template: string, data: Record<string, unknown>): Promise<void>;
}

interface StorageAdapter {
  upload(tenantId: string, path: string, data: Buffer, contentType: string): Promise<string>; // Returns URL
  delete(tenantId: string, path: string): Promise<void>;
  getPresignedUrl(tenantId: string, path: string, expiresIn: number): Promise<string>;
}

interface CDNAdapter {
  deploy(tenantId: string, siteId: string, assets: DeploymentAsset[]): Promise<DeploymentResult>;
  invalidate(tenantId: string, siteId: string, paths: string[]): Promise<void>;
}
```

These adapters follow the Strategy Pattern. Implementation can swap between providers:
- Billing: Stripe (default), Razorpay (India)
- Domains: Namecheap, Cloudflare Registrar
- Email: Resend, AWS SES
- Storage: Cloudflare R2 (default), AWS S3
- CDN: Cloudflare (default), AWS CloudFront

---

## 14. Deployment & Scaling

### 14.1 Single-instance (Starter)

```
Docker Compose:
  - kitsy-server (Node.js)
  - postgres (Supabase local or standalone)
  - redis

Suitable for: development, < 100 concurrent connections
```

### 14.2 Multi-instance (Pro+)

```
Kubernetes / Fly.io:
  - N kitsy-server pods (stateless, horizontal scale)
  - PostgreSQL (managed: Supabase, Neon, RDS)
  - Redis cluster (managed: Upstash, ElastiCache)
  - Load balancer with sticky sessions (WebSocket affinity)

Scaling triggers:
  - CPU > 70%: scale up
  - Active connections > 8000/pod: scale up
  - Memory > 80%: scale up (possible leak)
  - Scale to zero: when no active connections for 15 min (Fly.io machines)
```

### 14.3 Scale-to-zero strategy (cost control)

For Pro tier (lower usage), use Fly.io Machines or Cloudflare Durable Objects:

```
1. No active connections → machine stops after 15 min idle
2. New WebSocket connection → machine wakes in < 2s
3. Cold start penalty: first handshake takes ~2s instead of ~200ms
4. Acceptable for Pro tier; Enterprise gets always-on
```

### 14.4 WebSocket connection limits

| Plan | Max Connections/Tenant | Max Connections/Server Instance |
|------|----------------------|-------------------------------|
| Starter | 10 | N/A (shared) |
| Pro | 100 | 2,000 |
| Business | 500 | 5,000 |
| Enterprise | 5,000 | 10,000 |

---

## 15. Observability

### 15.1 Metrics (Prometheus-compatible)

```
kitsy_server_connections_active{tenant, plan}           # Gauge
kitsy_server_commands_total{type, tenant}                # Counter
kitsy_server_command_latency_ms{type}                    # Histogram
kitsy_server_config_saves_total{tenant}                  # Counter
kitsy_server_state_writes_total{tenant}                  # Counter
kitsy_server_ai_requests_total{agent, tenant}            # Counter
kitsy_server_ai_latency_ms{agent}                        # Histogram
kitsy_server_auth_failures_total{reason}                 # Counter
kitsy_server_rate_limit_hits_total{tenant}               # Counter
kitsy_server_redis_latency_ms{operation}                 # Histogram
kitsy_server_postgres_latency_ms{query}                  # Histogram
```

### 15.2 Structured logging

```json
{
  "level": "info",
  "timestamp": "2026-03-22T14:23:01.234Z",
  "service": "kitsy-server",
  "instanceId": "abc-123",
  "event": "command.routed",
  "tenantId": "tenant-456",
  "sessionId": "session-789",
  "command": {
    "type": "sync:state:write",
    "correlationId": "corr-012",
    "destination": "server"
  },
  "latencyMs": 2.4
}
```

### 15.3 Distributed tracing

`$correlationId` propagated across all hops. Export traces to:
- Stdout (development)
- OpenTelemetry (production) → Grafana Tempo, Jaeger, Datadog

---

## 16. Database Schema

### 16.1 Complete PostgreSQL schema

```sql
-- Tenants
CREATE TABLE tenants (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  plan         TEXT NOT NULL DEFAULT 'starter',
  owner_user_id TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sites (one tenant can have multiple sites)
CREATE TABLE sites (
  id           TEXT NOT NULL,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  name         TEXT NOT NULL,
  domain       TEXT,                      -- custom domain (nullable)
  subdomain    TEXT,                      -- kitsy subdomain (e.g., mybiz.kitsy.ai)
  status       TEXT NOT NULL DEFAULT 'draft', -- draft, published, archived
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);

-- Configs (current state) — see Section 8
CREATE TABLE configs (
  tenant_id    TEXT NOT NULL,
  site_id      TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  config       JSONB NOT NULL,
  checksum     TEXT NOT NULL,
  updated_by   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, site_id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id)
);

-- Config version history — see Section 8
CREATE TABLE config_versions (
  tenant_id    TEXT NOT NULL,
  site_id      TEXT NOT NULL,
  version      INTEGER NOT NULL,
  patch        JSONB NOT NULL,
  snapshot     JSONB,
  checksum     TEXT NOT NULL,
  updated_by   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message      TEXT,
  PRIMARY KEY (tenant_id, site_id, version)
);

-- Shared state (durable, Pro+ plans)
CREATE TABLE shared_state (
  tenant_id    TEXT NOT NULL,
  site_id      TEXT NOT NULL,
  key          TEXT NOT NULL,
  value        JSONB NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  updated_by   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, site_id, key)
);

-- Deployments
CREATE TABLE deployments (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  site_id      TEXT NOT NULL,
  config_version INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending, building, deployed, failed
  cdn_url      TEXT,
  deployed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id)
);

-- Audit log
CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  user_id      TEXT,
  session_id   TEXT,
  action       TEXT NOT NULL,             -- "config.save", "state.write", "ai.generate", etc.
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant ON audit_log (tenant_id, created_at DESC);

-- Row Level Security (Supabase)
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own tenant's data
CREATE POLICY tenant_isolation ON configs
  USING (tenant_id = current_setting('app.tenant_id'));
-- (repeat for all tables)
```

---

## 17. API Surface

### 17.1 Bus commands (WebSocket)

| Command Type | Direction | Payload | Description |
|-------------|-----------|---------|-------------|
| `handshake` | C→S | `{ token, siteId, configVersion }` | Initial connection |
| `handshake:ack` | S→C | `{ sessionId, configVersion, config?, patch? }` | Connection accepted |
| `sync:config` | S→C | `{ version, patch }` | Config update push |
| `sync:config:ack` | C→S | `{ version }` | Client confirms config version |
| `sync:config:propose` | C→S | `{ patch }` | Client proposes config change |
| `sync:config:accepted` | S→C | `{ version, patch }` | Server accepted proposal |
| `sync:config:rejected` | S→C | `{ reason, currentVersion }` | Server rejected proposal |
| `sync:state:write` | C→S | `{ key, value, expectedVersion }` | Client writes state |
| `sync:state:ack` | S→C | `{ key, version }` | Server confirms state write |
| `sync:state` | S→C | `{ key, value, version, conflict? }` | State update broadcast |
| `auth:refresh` | C→S | `{ refreshToken }` | Token refresh request |
| `auth:refreshed` | S→C | `{ token, refreshToken, expiresAt }` | New tokens |
| `ai:generate-site` | C→S | `{ prompt, components, tokens }` | AI generation request |
| `ai:edit-section` | C→S | `{ sectionId, prompt }` | AI edit request |
| `ai:result` | S→C | `{ success, config?, errors? }` | AI response |
| `ping` | S→C | `{}` | Heartbeat |
| `pong` | C→S | `{}` | Heartbeat response |

### 17.2 REST endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| GET | `/ready` | None | Readiness check |
| GET | `/api/v1/configs` | JWT | List tenant configs |
| GET | `/api/v1/configs/:siteId` | JWT | Get current config |
| GET | `/api/v1/configs/:siteId/versions` | JWT | Version history |
| POST | `/api/v1/configs/:siteId` | JWT | Save config |
| POST | `/api/v1/configs/:siteId/rollback` | JWT | Rollback to version |
| POST | `/api/v1/publish/:siteId` | JWT | Trigger deploy |
| GET | `/api/v1/admin/sessions` | Service | Session stats |
| GET | `/metrics` | Internal | Prometheus metrics |

---

## 18. Error Taxonomy

```typescript
// All server errors follow this shape
interface KitsyServerError {
  code: string;                        // Machine-readable: "AUTH_EXPIRED_TOKEN"
  message: string;                     // Human-readable
  details?: Record<string, unknown>;   // Additional context
  retryable: boolean;                  // Can the client retry?
  httpStatus?: number;                 // For REST responses
}

// Error code families
const ERROR_CODES = {
  // Auth (1xxx)
  AUTH_MISSING_TOKEN:    { code: "AUTH_001", retryable: false, httpStatus: 401 },
  AUTH_INVALID_TOKEN:    { code: "AUTH_002", retryable: false, httpStatus: 401 },
  AUTH_EXPIRED_TOKEN:    { code: "AUTH_003", retryable: true,  httpStatus: 401 }, // Retry with refreshed token
  AUTH_REVOKED_TOKEN:    { code: "AUTH_004", retryable: false, httpStatus: 401 },
  AUTH_INSUFFICIENT_SCOPE: { code: "AUTH_005", retryable: false, httpStatus: 403 },

  // Tenant (2xxx)
  TENANT_NOT_FOUND:     { code: "TENANT_001", retryable: false, httpStatus: 404 },
  TENANT_SUSPENDED:     { code: "TENANT_002", retryable: false, httpStatus: 403 },

  // Config (3xxx)
  CONFIG_NOT_FOUND:     { code: "CONFIG_001", retryable: false, httpStatus: 404 },
  CONFIG_VALIDATION:    { code: "CONFIG_002", retryable: false, httpStatus: 422 },
  CONFIG_VERSION_CONFLICT: { code: "CONFIG_003", retryable: true, httpStatus: 409 },

  // State (4xxx)
  STATE_CONFLICT:       { code: "STATE_001", retryable: true, httpStatus: 409 },
  STATE_KEY_TOO_LARGE:  { code: "STATE_002", retryable: false, httpStatus: 413 },

  // Rate limit (5xxx)
  RATE_LIMIT_COMMANDS:  { code: "RATE_001", retryable: true, httpStatus: 429 },
  RATE_LIMIT_CONNECTIONS: { code: "RATE_002", retryable: true, httpStatus: 429 },
  RATE_LIMIT_AI:        { code: "RATE_003", retryable: true, httpStatus: 429 },

  // AI (6xxx)
  AI_GENERATION_FAILED: { code: "AI_001", retryable: true, httpStatus: 500 },
  AI_VALIDATION_FAILED: { code: "AI_002", retryable: true, httpStatus: 422 },
  AI_QUOTA_EXCEEDED:    { code: "AI_003", retryable: false, httpStatus: 429 },

  // Internal (9xxx)
  INTERNAL_ERROR:       { code: "INTERNAL_001", retryable: true, httpStatus: 500 },
  DATABASE_ERROR:       { code: "INTERNAL_002", retryable: true, httpStatus: 500 },
  REDIS_ERROR:          { code: "INTERNAL_003", retryable: true, httpStatus: 500 },
};
```

---

## 19. Configuration

```typescript
interface KitsyServerConfig {
  // Server
  port: number;                        // Default: 8080
  host: string;                        // Default: "0.0.0.0"
  instanceId?: string;                 // Auto-generated UUID if not set

  // Database
  database: {
    url: string;                       // PostgreSQL connection string
    poolSize: number;                  // Default: 20
    ssl: boolean;                      // Default: true in production
  };

  // Redis
  redis: {
    url: string;
    keyPrefix: string;                 // Default: "kitsy:"
  };

  // Auth
  auth: {
    jwtSecret: string;                 // Or jwksUrl for RS256
    jwksUrl?: string;
    tokenExpiry: string;               // Default: "15m"
    refreshTokenExpiry: string;        // Default: "7d"
  };

  // WebSocket
  websocket: {
    heartbeatInterval: number;         // Default: 30000 ms
    heartbeatTimeout: number;          // Default: 10000 ms
    maxMissedPongs: number;            // Default: 3
    maxPayloadSize: number;            // Default: 1MB
  };

  // Rate limiting
  rateLimiting: {
    enabled: boolean;
    windowMs: number;                  // Default: 60000 (1 min)
  };

  // AI
  ai: {
    enabled: boolean;
    providers: {
      anthropic?: { apiKey: string; defaultModel: string };
      openai?: { apiKey: string; defaultModel: string };
    };
  };

  // Config store
  configStore: {
    snapshotEvery: number;             // Default: 10 versions
    maxVersionHistory: number;         // Default: 100
  };

  // Observability
  observability: {
    logLevel: "debug" | "info" | "warn" | "error";
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    tracingExporter?: "stdout" | "otlp";
    otlpEndpoint?: string;
  };
}
```

Configuration is loaded from environment variables (12-factor) with `KITSY_` prefix:

```
KITSY_PORT=8080
KITSY_DATABASE_URL=postgresql://...
KITSY_REDIS_URL=redis://...
KITSY_AUTH_JWT_SECRET=...
KITSY_AI_ANTHROPIC_API_KEY=...
```

---

## 20. Implementation Sequence

### 20.1 Sprint plan (suggested 2-week sprints)

| Sprint | Deliverables |
|--------|-------------|
| **S1** | Project scaffold, Hono gateway, WebSocket upgrade, health endpoint, Docker Compose with Postgres + Redis |
| **S2** | SessionManager, handshake flow, JWT validation, basic auth middleware |
| **S3** | Server-side Blu EventBus, CommandRouter, $destination routing (local only, no cross-instance) |
| **S4** | ConfigStore (Postgres adapter), save/get/diff/history, JSON Patch generation |
| **S5** | Config sync protocol: initial sync on connect, push on save, ack/propose/accept/reject |
| **S6** | StateStore (Redis adapter), state sync protocol, optimistic updates, conflict resolution |
| **S7** | Tenant isolation middleware, rate limiting, audit logging |
| **S8** | CrossInstanceRelay (Redis pub/sub), multi-instance routing |
| **S9** | AI agent integration: effect handlers, LLM gateway, validation pipeline |
| **S10** | `@kitsy/blu-sync` client package, `@kitsy/protocol` types package |
| **S11** | Observability: Prometheus metrics, structured logging, OpenTelemetry tracing |
| **S12** | SSE fallback transport, token refresh flow, deployment pipeline (SSR + CDN) |
| **S13** | Integration testing suite, load testing, documentation |
| **S14** | Security audit, penetration testing, hardening |

### 20.2 Dependencies on other tracks

| Dependency | Required From | Required By |
|-----------|--------------|-------------|
| `@kitsy/blu-bus` rebrand (Phase 0) | Blu track | Sprint S3 |
| `@kitsy/blu-validate` (Phase 1) | Blu track | Sprint S4, S9 |
| `@kitsy/blu-wire` WebSocketTransport (Phase 1) | Blu track | Sprint S10 |
| `@kitsy/blu-schema` JSON Schema (Phase 0) | Blu track | Sprint S4, S9 |

These can be parallelized: the Blu track ships Phase 0 packages while the server track starts S1-S2 (which don't need Blu packages yet).
