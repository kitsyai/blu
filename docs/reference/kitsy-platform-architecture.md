# Kitsy Platform Architecture — AI-Native Business Operating System

**Version:** 1.0  
**Date:** 2026-03-22  
**Status:** Canonical platform-level architecture document  
**Owner:** HEYPKV Innovations Private Limited  
**Brand:** Kitsy (kitsy.ai)  
**Scope:** The platform shell, module architecture, shared infrastructure, AI workforce model, and tech offerings that compose into an AI-native ERP  
**Relationship to other docs:** This is the roof. All product-specific documents (the Blu framework docs at `docs/blu/`, Coop, future CRM/Finance/HRM specs) describe individual rooms in the house this document defines.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Vision](#2-platform-vision)
3. [System Map](#3-system-map)
4. [Module Architecture](#4-module-architecture)
5. [The Module Contract](#5-the-module-contract)
6. [Shared Identity & Auth](#6-shared-identity--auth)
7. [Shared Tenancy & Workspace](#7-shared-tenancy--workspace)
8. [The Kitsy Bus — Platform Nervous System](#8-the-kitsy-bus--platform-nervous-system)
9. [Shared Billing & Entitlements](#9-shared-billing--entitlements)
10. [Unified Dashboard Shell](#10-unified-dashboard-shell)
11. [Product Modules — Current & Planned](#11-product-modules--current--planned)
12. [Crew — AI Workforce](#12-crew--ai-workforce)
13. [Tech Infrastructure Offerings](#13-tech-infrastructure-offerings)
14. [Cross-Module Data Flow](#14-cross-module-data-flow)
15. [Marketplace & Extensibility](#15-marketplace--extensibility)
16. [Platform API](#16-platform-api)
17. [Security Architecture](#17-security-architecture)
18. [Infrastructure & Deployment](#18-infrastructure--deployment)
19. [Revenue Architecture](#19-revenue-architecture)
20. [Platform Roadmap](#20-platform-roadmap)
21. [Key Architectural Decisions](#21-key-architectural-decisions)

---

## 1. Executive Summary

Kitsy is an **AI-native business operating system**. It provides businesses with modular software capabilities — website building, project management, CRM, finance, HR — unified under a single identity, a shared data bus, and an AI workforce that operates across all modules.

Kitsy is NOT a website builder with extra features bolted on. The platform architecture is designed module-first: any business capability plugs into a shared shell that provides identity, tenancy, billing, communication, and AI infrastructure. The first two modules are **Blu** (UI/website infrastructure) and **Coop** (product/project management). But the architecture accommodates N modules without restructuring.

The defining technical characteristic is the **EventBus backbone** — originally designed for Blu's UI communication, but architecturally positioned as the platform-wide nervous system. Every module, every AI agent, every background service can participate in the same typed, transport-aware, tenant-isolated command protocol. This is what makes Kitsy more than a bundle of SaaS tools — it's an integrated operating environment where a CRM event can trigger a finance workflow can notify an AI agent can update a customer-facing website, all through one communication fabric.

**The thesis:** Businesses don't need 15 separate SaaS subscriptions with 15 separate logins, 15 data silos, and zero integration. They need one platform where their data, their AI workforce, and their tools talk to each other.

---

## 2. Platform Vision

### 2.1 The three layers of Kitsy

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: PRODUCT MODULES                                │
│  "The capabilities businesses use"                       │
│                                                         │
│  Blu         Coop        CRM        Finance    HRM      │
│  (websites)  (projects)  (customer) (accounts) (people) │
│  ...and more as the platform grows                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  LAYER 2: AI INFRASTRUCTURE                              │
│  "The intelligence that operates across modules"         │
│                                                         │
│  Mind          Crew                 Knowledge Base       │
│  (AI engine)   (AI workforce:       (shared context      │
│                 accountant, ops,     across modules)      │
│                 developer, etc.)                          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  LAYER 3: PLATFORM SHELL                                 │
│  "The shared infrastructure everything runs on"          │
│                                                         │
│  Identity    Tenancy    Billing     EventBus    Storage  │
│  & Auth      & Spaces   & Plans     Backbone    & CDN   │
│                                                         │
│  Dashboard   Compute    Marketplace  Notifications       │
│  Shell       & AI Infra              & Comms             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Design principles

| Principle | What It Means |
|-----------|--------------|
| **Module-first** | The platform shell is product-agnostic. Adding a new module (CRM, Finance) should not require changes to the shell. |
| **Shared identity** | One account, one login, one team. A user's identity and permissions span all modules. |
| **Shared data bus** | The EventBus is the universal communication fabric. Modules talk to each other through typed commands, not ad-hoc API calls. |
| **AI-native** | AI is not a feature of individual modules — it's a platform-level capability. An AI agent can operate across CRM data, finance records, and project tasks in one workflow. |
| **Composable billing** | Businesses buy the modules they need. Billing is per-module with a platform base. Not an all-or-nothing bundle. |
| **Extensible** | Third-party developers can build modules, Crew agents, and integrations via the module contract and marketplace. |

### 2.3 What Kitsy is NOT

- Not a monolithic ERP that forces all-or-nothing adoption
- Not a marketplace of disconnected micro-apps
- Not a thin integration layer over third-party SaaS (like Zapier)
- Not an AI wrapper around existing tools

Kitsy builds the tools AND the AI AND the infrastructure. The integration is native, not bolted on.

---

## 3. System Map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              kitsy.ai                                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED DASHBOARD SHELL                           │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐│   │
│  │  │  Blu   │ │  Coop  │ │  CRM   │ │Finance │ │  HRM   │ │ More  ││   │
│  │  │(sites) │ │(projec)│ │(custom)│ │(invoic)│ │(people)│ │  ...  ││   │
│  │  └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘ └───┬───┘│   │
│  │       └──────────┴──────────┴──────────┴──────────┴──────────┘    │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                        │
│  ┌──────────────────────────────────▼───────────────────────────────────┐   │
│  │                    KITSY BUS (EventBus Backbone)                      │   │
│  │  Transport-aware • Tenant-isolated • AI-participatory • Typed        │   │
│  └───┬──────────┬───────────┬──────────┬──────────┬──────────┬─────────┘   │
│      │          │           │          │          │          │              │
│  ┌───▼───┐ ┌───▼───┐ ┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌───▼──────────┐  │
│  │ Auth  │ │Tenant │ │ Billing │ │ Store │ │ Notify│ │  Crew          │  │
│  │& Ident│ │& Space│ │& Entitl│ │& CDN  │ │& Comms│ │  (AI Workers)  │  │
│  └───────┘ └───────┘ └─────────┘ └───────┘ └───────┘ │  ┌──────────┐ │  │
│                                                        │  │Accountant│ │  │
│                                                        │  │Ops Agent │ │  │
│                                                        │  │Dev Agent │ │  │
│                                                        │  │Sales Rep │ │  │
│                                                        │  │HR Agent  │ │  │
│                                                        │  └──────────┘ │  │
│                                                        └───────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    INFRASTRUCTURE                                   │   │
│  │  PostgreSQL (Supabase)  •  Redis (Upstash)  •  Object Store (R2)  │   │
│  │  Compute (Fly.io)  •  CDN (Cloudflare)  •  AI Compute (LLM APIs)  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Module Architecture

### 4.1 What is a module?

A **module** is a self-contained business capability that plugs into the Kitsy platform shell. Each module:

- Has its own UI, rendered within the dashboard shell
- Has its own data schema (tables, stored in the shared database with tenant isolation)
- Has its own bus command namespace (e.g., `blu:*`, `coop:*`, `crm:*`)
- Has its own API endpoints (mounted under `/api/v1/{module}/`)
- Can subscribe to commands from other modules (cross-module integration)
- Can register Crew agent capabilities (what AI agents can do with this module's data)
- Has its own billing metering (usage tracked per module)

### 4.2 Module isolation vs. integration

```
ISOLATION (each module owns):
  ├── Data schema (own tables, RLS-isolated)
  ├── Bus namespace (crm:* commands don't collide with blu:* commands)
  ├── API endpoints (/api/v1/crm/*)
  ├── UI routes (/crm/*)
  ├── Settings page (/settings/crm)
  └── Module-specific Crew agent skills

INTEGRATION (modules share):
  ├── Identity (one user, one JWT, same roles across modules)
  ├── Tenant (one workspace, all modules see same tenantId)
  ├── EventBus (modules can subscribe to each other's events)
  ├── Knowledge Base (AI agents have cross-module context)
  ├── Billing (one subscription, module add-ons)
  ├── Dashboard shell (unified navigation, notifications)
  ├── Search (cross-module search in the unified dashboard)
  └── Audit log (all actions across all modules in one log)
```

### 4.3 Module lifecycle

```
STAGES:
  1. Incubation  — module being developed internally or by third party
  2. Alpha       — available to internal team for testing
  3. Beta        — available to selected tenants (feature flag)
  4. GA          — generally available to all tenants
  5. Deprecated  — marked for sunset, data export available
  6. Retired     — removed from platform

Each module can be independently at any stage.
Blu: GA (first module)
Coop: Beta (second module)
CRM, Finance, HRM: Incubation (future)
```

---

## 5. The Module Contract

This is the most important section in this document. The module contract defines how any capability — first-party or third-party — integrates with the Kitsy platform.

### 5.1 Module manifest

Every module declares itself via a manifest:

```typescript
interface KitsyModuleManifest {
  // ─── Identity ───
  id: string;                           // "blu", "coop", "crm", "finance"
  name: string;                         // "Blu", "Coop", "CRM"
  description: string;
  version: string;                      // Semver
  icon: string;                         // Icon for dashboard navigation
  color: string;                        // Brand color for module UI accents

  // ─── UI ───
  routes: ModuleRoute[];                // Routes this module registers in the dashboard
  settingsRoute?: string;               // Module settings page route
  dashboardWidget?: ModuleWidget;       // Optional widget for the main dashboard

  // ─── Bus ───
  namespace: string;                    // Bus command namespace: "blu", "coop", "crm"
  commands: ModuleCommandDefinition[];  // Commands this module dispatches
  subscriptions: ModuleSubscription[];  // Commands from OTHER modules this module listens to
  
  // ─── Data ───
  migrations: string;                   // Path to SQL migration files
  entities: ModuleEntity[];             // Data entities this module manages (for cross-module reference)

  // ─── AI ───
  crewSkills: CrewSkillDefinition[];    // What Crew agents can do with this module
  knowledgeSources: KnowledgeSource[];  // What data this module contributes to the AI Knowledge Base

  // ─── Billing ───
  billingMetrics: BillingMetric[];      // What usage this module meters
  requiredPlan?: string;                // Minimum plan to activate (e.g., "pro")

  // ─── Permissions ───
  permissions: ModulePermission[];      // Module-specific permission scopes

  // ─── Lifecycle ───
  onInstall?(context: ModuleContext): Promise<void>;
  onUninstall?(context: ModuleContext): Promise<void>;
  onTenantCreate?(context: ModuleContext, tenantId: string): Promise<void>;
  onTenantDelete?(context: ModuleContext, tenantId: string): Promise<void>;
}
```

### 5.2 Module routes

```typescript
interface ModuleRoute {
  path: string;                         // "/blu", "/coop", "/crm"
  label: string;                        // "Websites", "Projects", "Customers"
  icon: string;
  component: string;                    // Lazy-loaded module root component
  children?: ModuleRoute[];             // Sub-routes
  requirePermission?: string;           // Permission scope required to see this route
}

// Example: Blu module routes
const bluRoutes: ModuleRoute[] = [
  { path: "/blu", label: "Websites", icon: "globe", component: "@kitsy/blu-dashboard" },
  { path: "/blu/sites", label: "All Sites", icon: "list", component: "@kitsy/blu-dashboard/sites" },
  { path: "/blu/site/:id/studio", label: "Studio", icon: "edit", component: "@kitsy/studio" },
  { path: "/blu/marketplace", label: "Templates", icon: "shopping-bag", component: "@kitsy/blu-marketplace" },
];

// Example: Coop module routes
const coopRoutes: ModuleRoute[] = [
  { path: "/coop", label: "Projects", icon: "folder", component: "@kitsy/coop-dashboard" },
  { path: "/coop/boards", label: "Boards", icon: "columns", component: "@kitsy/coop-boards" },
  { path: "/coop/timeline", label: "Timeline", icon: "calendar", component: "@kitsy/coop-timeline" },
  { path: "/coop/backlog", label: "Backlog", icon: "list", component: "@kitsy/coop-backlog" },
];
```

### 5.3 Module bus commands

```typescript
interface ModuleCommandDefinition {
  type: string;                         // "crm:contact:created"
  description: string;                  // "Fired when a new contact is created"
  payloadSchema: JSONSchema;            // Schema of the command payload
  direction: "dispatch" | "subscribe" | "both";
  visibility: "internal" | "cross-module" | "public";
}

// Example: CRM module commands
const crmCommands: ModuleCommandDefinition[] = [
  {
    type: "crm:contact:created",
    description: "New contact added to CRM",
    payloadSchema: { type: "object", properties: { contactId: { type: "string" }, name: { type: "string" }, email: { type: "string" } } },
    direction: "dispatch",
    visibility: "cross-module"         // Other modules can subscribe to this
  },
  {
    type: "crm:deal:won",
    description: "Deal marked as won",
    payloadSchema: { type: "object", properties: { dealId: { type: "string" }, value: { type: "number" }, contactId: { type: "string" } } },
    direction: "dispatch",
    visibility: "cross-module"
  }
];

// Example: Finance module subscribing to CRM events
const financeSubscriptions: ModuleSubscription[] = [
  {
    type: "crm:deal:won",
    handler: "finance:auto-create-invoice",  // Finance effect that auto-generates an invoice
    description: "Auto-create invoice when a deal is won"
  }
];
```

### 5.4 Module entities (cross-module references)

Modules can reference each other's entities without direct database coupling:

```typescript
interface ModuleEntity {
  name: string;                         // "contact", "project", "invoice", "site"
  module: string;                       // "crm", "coop", "finance", "blu"
  idField: string;                      // "contactId", "projectId"
  displayField: string;                 // "name", "title" — for UI display in other modules
  searchable: boolean;                  // Include in cross-module search
  
  // How other modules can reference this entity
  referenceEndpoint: string;            // "/api/v1/crm/contacts/:id/summary"
  // Returns a lightweight summary object, not the full entity
}

// Example cross-module reference:
// A Coop project can link to CRM contacts (client for the project)
// A Finance invoice can link to a CRM contact (who to bill)
// A Blu site can link to a Coop project (which project manages this site)
// All through entity references, not direct table joins
```

### 5.5 Module permissions

```typescript
interface ModulePermission {
  scope: string;                        // "blu:sites:write", "coop:boards:admin", "crm:contacts:read"
  displayName: string;                  // "Create and edit websites"
  description: string;
  grantedByRoles: string[];             // ["owner", "admin", "editor"] — which platform roles get this by default
}

// Platform roles map to module permissions:
// Owner  → all module permissions
// Admin  → most module permissions (except billing)
// Editor → read/write in assigned modules
// Viewer → read-only in assigned modules
//
// Module-specific roles can be added (e.g., "crm:sales-rep" with custom permissions)
```

---

## 6. Shared Identity & Auth

### 6.1 Single identity

One account spans all modules. Users don't create separate accounts for Blu, Coop, or CRM.

```typescript
interface KitsyUser {
  id: string;                           // Supabase auth.users.id
  email: string;
  displayName: string;
  avatarUrl?: string;
  
  // Platform-level
  tenants: TenantMembership[];          // User can belong to multiple workspaces
  preferences: UserPreferences;         // UI preferences, notification settings
  onboarding: OnboardingState;
  
  // No module-specific fields here — modules store their own user data
  // linked via the shared userId
}
```

### 6.2 JWT claims (platform-level)

```typescript
interface KitsyJWTPayload {
  sub: string;                          // userId
  tid: string;                          // active tenantId (workspace)
  roles: string[];                      // ["owner"] — platform roles
  plan: string;                         // "starter", "pro", "business", "enterprise"
  modules: string[];                    // ["blu", "coop"] — activated modules
  scopes: string[];                     // ["blu:sites:write", "coop:boards:admin", ...]
  iss: "kitsy.ai";
  aud: "kitsy-platform";
  exp: number;
  iat: number;
  jti: string;
}
```

The `modules` claim tells the platform which modules this tenant has activated. The `scopes` claim is the union of all module-specific permissions for this user's role.

### 6.3 Auth flow

```
1. User signs up at kitsy.ai
2. Platform creates:
   - Auth user (Supabase)
   - User profile
   - Default tenant (workspace)
   - Tenant membership (user = owner)
3. User activates modules (Blu, Coop, etc.) — some free, some paid
4. JWT issued with: userId, tenantId, roles, plan, activated modules, scopes
5. Same JWT used for:
   - Platform API calls
   - Kitsy Server WebSocket (for Blu real-time features)
   - Module-specific API calls
   - Crew agent authorization
```

---

## 7. Shared Tenancy & Workspace

### 7.1 Tenant model

A **tenant** is a workspace — typically a business. One user can own or belong to multiple tenants (e.g., a freelancer managing multiple client workspaces).

```sql
CREATE TABLE tenants (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  
  -- Plan
  plan              TEXT NOT NULL DEFAULT 'starter',
  plan_period       TEXT DEFAULT 'monthly',
  
  -- Activated modules
  active_modules    TEXT[] NOT NULL DEFAULT '{blu}',    -- Always starts with Blu
  
  -- Shared limits
  max_team_members  INTEGER NOT NULL DEFAULT 1,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  storage_limit_bytes BIGINT NOT NULL DEFAULT 104857600,
  
  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Metadata
  industry          TEXT,
  timezone          TEXT DEFAULT 'Asia/Kolkata',
  locale            TEXT DEFAULT 'en',
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Module-specific tenant data is stored in module tables, not here
-- This table only contains platform-level tenant configuration
```

### 7.2 Module activation

```typescript
// When a tenant activates a module:
async function activateModule(tenantId: string, moduleId: string): Promise<void> {
  // 1. Check plan allows this module
  const tenant = await getTenant(tenantId);
  const modulePlan = MODULE_MANIFESTS[moduleId].requiredPlan;
  if (modulePlan && PLAN_RANK[tenant.plan] < PLAN_RANK[modulePlan]) {
    throw new PlanError("UPGRADE_REQUIRED", modulePlan);
  }

  // 2. Run module's tenant initialization
  const manifest = MODULE_MANIFESTS[moduleId];
  if (manifest.onTenantCreate) {
    await manifest.onTenantCreate(moduleContext, tenantId);
  }

  // 3. Run module database migrations
  await runMigrations(moduleId, tenantId);

  // 4. Add to active_modules
  await db.query(`UPDATE tenants SET active_modules = array_append(active_modules, $1) WHERE id = $2`, [moduleId, tenantId]);

  // 5. Update JWT scopes (next token refresh includes new module permissions)

  // 6. Dispatch platform event
  bus.dispatch({ type: "platform:module:activated", payload: { tenantId, moduleId } });
}
```

### 7.3 Data isolation

Every module's tables include `tenant_id` as part of the primary key or a required foreign key. Row Level Security (Supabase) enforces isolation.

```sql
-- Every module table follows this pattern:
CREATE TABLE {module}_some_table (
  id          TEXT NOT NULL,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  -- ... module-specific columns ...
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE {module}_some_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {module}_some_table
  USING (tenant_id = current_setting('app.tenant_id'));
```

---

## 8. The Kitsy Bus — Platform Nervous System

### 8.1 Bus architecture at platform level

The event fabric designed for Blu (bus in `docs/blu/specification.md` §8, transport in §9) serves as the platform-wide communication backbone. Every module, every AI agent, every background service participates.

```
┌─────────────────────────────────────────────────────────────┐
│                    KITSY BUS                                 │
│                                                             │
│  Command Namespaces:                                         │
│  ├── platform:*    — platform shell events                   │
│  ├── blu:*         — Blu module commands                     │
│  ├── coop:*        — Coop module commands                    │
│  ├── crm:*         — CRM module commands (future)            │
│  ├── finance:*     — Finance module commands (future)        │
│  ├── hrm:*         — HRM module commands (future)            │
│  ├── crew:*        — Crew AI agent commands                  │
│  ├── ai:*          — AI infrastructure commands              │
│  └── infra:*       — Infrastructure service commands         │
│                                                             │
│  Transport Layer:                                            │
│  ├── LocalTransport      (in-process, default)               │
│  ├── WebSocketTransport  (browser ↔ server, for real-time)   │
│  ├── BroadcastChannel    (cross-tab sync)                    │
│  ├── RedisTransport      (cross-instance server relay)       │
│  └── WorkerTransport     (background worker communication)   │
│                                                             │
│  Middleware Pipeline (applied to ALL commands):               │
│  1. Auth        → validate JWT, extract identity             │
│  2. Tenant      → scope command to tenant, reject cross-     │
│  3. Module      → verify sender has access to this namespace │
│  4. Rate Limit  → per-tenant, per-module quotas              │
│  5. Audit       → log to shared audit trail                  │
│  6. Route       → deliver to correct module/agent/browser    │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Cross-module communication

The bus enables modules to react to each other's events without direct coupling:

```
SCENARIO: Deal won in CRM → auto-create invoice in Finance → notify via email

1. Sales rep marks deal as won in CRM
2. CRM dispatches: { type: "crm:deal:won", payload: { dealId, value, contactId } }
3. Finance module's effect handler triggers (subscribed to "crm:deal:won"):
   → Creates invoice draft
   → Dispatches: { type: "finance:invoice:created", payload: { invoiceId, dealId, amount } }
4. Notification service's effect handler triggers (subscribed to "finance:invoice:created"):
   → Sends email to finance team: "New invoice draft $5,000 from Acme Corp"
5. Crew Accountant agent sees "finance:invoice:created":
   → Auto-categorizes line items
   → Applies tax rules
   → Dispatches: { type: "finance:invoice:ready", payload: { invoiceId } }

All of this happens through the bus. No direct API calls between modules.
No module needs to know which other modules exist.
New modules can subscribe to existing events without modifying the source.
```

### 8.3 Why the bus (not REST/GraphQL between modules)

| Approach | Coupling | Discoverability | Real-time | AI Integration |
|----------|---------|-----------------|-----------|---------------|
| Direct REST calls between modules | High (URL, schema dependency) | None (who calls whom?) | Polling | Separate integration |
| Shared GraphQL gateway | Medium (schema coordination) | Schema-level | Subscriptions | Query-based |
| **EventBus (Kitsy approach)** | **Low (namespace + payload schema)** | **Manifest-declared** | **Native** | **AI agents are just subscribers** |

The bus pattern was chosen because it gives the lowest coupling, native real-time support, and treats AI agents identically to any other participant. A Crew agent subscribing to `crm:deal:won` is architecturally identical to the Finance module subscribing to it.

### 8.4 Command namespace governance

```
Rules:
1. Each module owns its namespace exclusively: only CRM dispatches crm:* commands
2. Any module can SUBSCRIBE to any public cross-module event
3. Commands with visibility "internal" are not relayed outside the originating module
4. The platform:* namespace is reserved for shell events (auth, module activation, etc.)
5. The crew:* namespace is reserved for AI workforce commands
6. Namespace collision is impossible because module IDs are unique and manifests are validated
```

---

## 9. Shared Billing & Entitlements

### 9.1 Billing architecture

Kitsy uses a **platform base + module add-on** model:

```
┌────────────────────────────────────────────────────┐
│  BILLING MODEL                                      │
│                                                    │
│  Platform Base (required):                          │
│  ├── Starter:  Free  (1 user, limited features)    │
│  ├── Pro:      $29/mo  (team, AI, custom domains)  │
│  ├── Business: $99/mo  (advanced, collaboration)   │
│  └── Enterprise: Custom                            │
│                                                    │
│  Module Add-Ons (optional per module):              │
│  ├── Blu:     Included in all plans (core module)  │
│  ├── Coop:    $9/mo per user (Pro+)                │
│  ├── CRM:     $15/mo per user (Pro+, future)       │
│  ├── Finance: $19/mo per user (Pro+, future)       │
│  ├── HRM:     $12/mo per user (Business+, future)  │
│  └── Crew:    Usage-based (per AI task, future)     │
│                                                    │
│  Tech Infrastructure Add-Ons:                       │
│  ├── Extra storage:  $5/mo per 5GB                 │
│  ├── Extra AI:       $9/mo per 100 requests        │
│  ├── CDN bandwidth:  Usage-based (future)          │
│  └── Compute:        Usage-based (future)          │
└────────────────────────────────────────────────────┘
```

### 9.2 Entitlement engine

```typescript
interface EntitlementEngine {
  // Check if a tenant can perform an action
  check(tenantId: string, entitlement: string): Promise<EntitlementResult>;
  
  // Record usage
  record(tenantId: string, metric: string, quantity: number): Promise<void>;
  
  // Get usage summary
  usage(tenantId: string): Promise<UsageSummary>;
}

interface EntitlementResult {
  allowed: boolean;
  reason?: string;                      // "plan_required:pro", "quota_exceeded:ai_requests"
  currentUsage?: number;
  limit?: number;
  upgradeOption?: string;               // Which plan/add-on unlocks this
}

// Entitlement checks are bus middleware — runs on every command
// that requires plan-gated access
```

### 9.3 Metering

Each module declares what it meters:

```typescript
// Blu module billing metrics
const bluMetrics: BillingMetric[] = [
  { id: "blu:sites", type: "count", description: "Number of active sites" },
  { id: "blu:storage", type: "cumulative", unit: "bytes", description: "Asset storage used" },
  { id: "blu:ai_requests", type: "count", period: "monthly", description: "AI generation requests" },
  { id: "blu:deploys", type: "count", period: "monthly", description: "Site deployments" },
];

// Coop module billing metrics
const coopMetrics: BillingMetric[] = [
  { id: "coop:projects", type: "count", description: "Active projects" },
  { id: "coop:members", type: "count", description: "Project collaborators" },
];
```

---

## 10. Unified Dashboard Shell

### 10.1 Shell architecture

The dashboard shell is a Blu app that provides navigation, workspace switching, notifications, and a module container. Individual modules render inside the container.

```
┌──────────────────────────────────────────────────────────────────┐
│  kitsy.ai            [Workspace: My Business ▾]  [🔔] [👤 Menu] │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│  ▶ Home  │  ┌─────────────────────────────────────────────────┐ │
│           │  │                                                 │ │
│  MODULES  │  │         MODULE CONTENT AREA                     │ │
│  ├ 🌐 Blu │  │                                                 │ │
│  ├ 📋 Coop│  │  (Rendered by the active module)                │ │
│  ├ 👥 CRM │  │                                                 │ │
│  ├ 💰 Fin │  │  Each module is lazy-loaded when                │ │
│  └ 👤 HRM │  │  its nav item is clicked.                       │ │
│           │  │                                                 │ │
│  PLATFORM │  │  Module has full control of this area.          │ │
│  ├ 🤖 Crew│  │  Shell provides: breadcrumbs, back navigation,  │ │
│  ├ ⚙ Set  │  │  notification toasts, command palette.          │ │
│  └ 💳 Bill│  │                                                 │ │
│           │  └─────────────────────────────────────────────────┘ │
│           │                                                       │
│  [+ Add   │  ┌─────────────────────────────────────────────────┐ │
│   Module] │  │  🤖 Crew Assistant          [expand ↗]          │ │
│           │  │  "How can I help today?"                         │ │
│           │  └─────────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────────┘
```

### 10.2 Navigation model

```typescript
// Shell reads activated modules from tenant config
// and builds navigation dynamically from module manifests

function buildNavigation(tenant: Tenant): NavItem[] {
  const items: NavItem[] = [
    { path: "/", label: "Home", icon: "home", type: "platform" },
  ];

  // Add activated modules
  for (const moduleId of tenant.active_modules) {
    const manifest = MODULE_MANIFESTS[moduleId];
    items.push({
      path: manifest.routes[0].path,
      label: manifest.name,
      icon: manifest.icon,
      type: "module",
      children: manifest.routes.slice(1),
    });
  }

  // Platform items
  items.push(
    { path: "/crew", label: "Crew", icon: "users", type: "platform" },
    { path: "/settings", label: "Settings", icon: "settings", type: "platform" },
  );

  return items;
}
```

### 10.3 Module loading

Modules are loaded lazily. When user navigates to `/coop`, the Coop module JS bundle is fetched and mounted in the content area.

```typescript
// Shell route configuration
const moduleRoutes = tenant.active_modules.map(moduleId => {
  const manifest = MODULE_MANIFESTS[moduleId];
  return {
    path: `/${moduleId}/*`,
    component: React.lazy(() => import(manifest.routes[0].component)),
  };
});
```

### 10.4 Home / dashboard

The home page shows a unified view across all activated modules:

```
Home
├── Quick Actions: [New Site] [New Project] [New Contact] [Ask Crew]
├── Widgets (contributed by each active module):
│   ├── Blu:  "3 sites, 1,234 page views this week"
│   ├── Coop: "5 active projects, 12 tasks due this week"
│   └── CRM:  "45 contacts, 3 deals in pipeline" (when activated)
├── Recent Activity (cross-module, from audit log):
│   ├── Published "My Bakery" site — 2h ago [Blu]
│   ├── Completed task "Design review" — 3h ago [Coop]
│   └── Added contact "Acme Corp" — yesterday [CRM]
└── Crew Suggestions (AI-generated):
    └── "You have 3 overdue tasks in Coop. Want me to prioritize them?"
```

### 10.5 Command palette (Cmd+K)

Universal search and command palette that spans all modules:

```
┌─────────────────────────────────────────┐
│  🔍 Search or type a command...          │
│                                         │
│  RECENT                                 │
│  📄 My Bakery site                [Blu] │
│  📋 Q2 Launch project             [Coop]│
│                                         │
│  ACTIONS                                │
│  ➕ New site                       [Blu] │
│  ➕ New project                    [Coop]│
│  🤖 Ask Crew                             │
│  ⚙️ Settings                             │
│                                         │
│  SEARCH RESULTS                         │
│  👤 Acme Corp                      [CRM]│
│  💰 Invoice #1042                  [Fin] │
└─────────────────────────────────────────┘
```

Search queries are routed to each active module's search endpoint. Results are aggregated and ranked by relevance.

---

## 11. Product Modules — Current & Planned

### 11.1 Blu — UI/Website Infrastructure (GA)

| Aspect | Detail |
|--------|--------|
| **What it does** | Create, edit, and publish websites and web applications |
| **Key capabilities** | Visual builder (Studio), AI generation (Mind), CDN hosting, custom domains, templates |
| **Bus namespace** | `blu:*` |
| **Dedicated docs** | Blu framework (`docs/blu/*.md`), Component Spec, Server Spec, Studio Spec, Mind Spec, Blu Product Hosting Spec |
| **Crew skills** | `crew:build-site`, `crew:edit-site`, `crew:suggest-theme` |

### 11.2 Coop — Product & Project Management (Beta)

| Aspect | Detail |
|--------|--------|
| **What it does** | Manage projects, tasks, sprints, backlogs, roadmaps |
| **Key capabilities** | Kanban boards, timeline/Gantt, backlog management, sprint planning, task assignment |
| **Bus namespace** | `coop:*` |
| **Key entities** | Project, Board, Task, Sprint, Label, Milestone |
| **Dedicated doc** | Separate Coop spec (exists, not covered in this document) |
| **Crew skills** | `crew:create-task`, `crew:prioritize-backlog`, `crew:write-spec`, `crew:standup-summary` |
| **Cross-module** | Subscribes to: `blu:site:published` (auto-complete "publish" tasks), `crm:deal:won` (auto-create onboarding project) |

### 11.3 CRM — Customer Relationship Management (Planned)

| Aspect | Detail |
|--------|--------|
| **What it does** | Manage contacts, companies, deals, pipeline, communications |
| **Key capabilities** | Contact management, deal pipeline, activity timeline, email integration, lead scoring |
| **Bus namespace** | `crm:*` |
| **Key entities** | Contact, Company, Deal, Activity, Pipeline, Stage |
| **Crew skills** | `crew:enrich-contact`, `crew:score-lead`, `crew:draft-email`, `crew:pipeline-report` |
| **Cross-module** | Dispatches: `crm:deal:won` → Finance creates invoice, Coop creates onboarding project |

### 11.4 Finance — Accounts, Invoicing, Billing (Planned)

| Aspect | Detail |
|--------|--------|
| **What it does** | Invoicing, expense tracking, basic accounting, payment tracking |
| **Key capabilities** | Invoice creation/sending, expense logging, payment tracking, tax calculation, reports |
| **Bus namespace** | `finance:*` |
| **Key entities** | Invoice, Expense, Payment, Account, TaxRule, LineItem |
| **Crew skills** | `crew:create-invoice`, `crew:categorize-expense`, `crew:tax-estimate`, `crew:monthly-report` |
| **Cross-module** | Subscribes to: `crm:deal:won` → auto-create invoice, `hrm:payroll:approved` → generate payments |

### 11.5 HRM — Human Resources & Payroll (Planned)

| Aspect | Detail |
|--------|--------|
| **What it does** | Employee management, leave tracking, payroll, onboarding |
| **Key capabilities** | Employee directory, leave management, payroll processing, document management, onboarding checklists |
| **Bus namespace** | `hrm:*` |
| **Key entities** | Employee, LeaveRequest, PayrollRun, Department, Position |
| **Crew skills** | `crew:onboard-employee`, `crew:process-leave`, `crew:payroll-summary` |
| **Cross-module** | Dispatches: `hrm:payroll:approved` → Finance generates payment records |

### 11.6 Module dependency map

```
        CRM ──────────► Finance
         │                 ▲
         │                 │
         ▼                 │
        Coop              HRM
         │
         ▼
        Blu

Arrows = "dispatches events consumed by"
All modules are optional. Cross-module subscriptions gracefully no-op if the source module isn't activated.
```

---

## 12. Crew — AI Workforce

### 12.1 Concept

Crew is Kitsy's AI workforce. Instead of "AI features" scattered across modules, Crew provides **named AI agents that can be hired to do specific jobs** — like hiring a virtual accountant, operations manager, or developer.

Each Crew agent has:
- A persona (name, role, avatar)
- Skills from one or more modules
- Access to the Knowledge Base (cross-module context)
- A conversation interface in the dashboard

### 12.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CREW                                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Crew Manager                                         │  │
│  │  • Agent registry (available agents per plan)         │  │
│  │  • Skill resolution (which module skills an agent has)│  │
│  │  • Conversation routing                               │  │
│  │  • Usage metering                                     │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────┐ ┌────────────┐ ┌─────────────┐ ┌─────────┐│
│  │ Accountant│ │ Ops Manager│ │  Developer  │ │Sales Rep││
│  │           │ │            │ │             │ │         ││
│  │ Skills:   │ │ Skills:    │ │ Skills:     │ │ Skills: ││
│  │ • finance:│ │ • coop:    │ │ • blu:      │ │ • crm:  ││
│  │   invoice │ │   task mgmt│ │   build site│ │   enrich││
│  │ • finance:│ │ • coop:    │ │ • blu:      │ │ • crm:  ││
│  │   expense │ │   prioritze│ │   edit site │ │   draft ││
│  │ • finance:│ │ • hrm:     │ │ • coop:     │ │   email ││
│  │   report  │ │   leave    │ │   write spec│ │ • crm:  ││
│  │           │ │            │ │             │ │   report││
│  └───────────┘ └────────────┘ └─────────────┘ └─────────┘│
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Knowledge Base                                       │  │
│  │  Cross-module context that ALL Crew agents can access  │  │
│  │                                                       │  │
│  │  • Tenant profile (business type, industry, size)     │  │
│  │  • Module data summaries (contacts, projects, invoices)│ │
│  │  • Conversation history (per agent, per user)         │  │
│  │  • Business rules and preferences                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 12.3 Crew skill definition

```typescript
interface CrewSkillDefinition {
  id: string;                           // "blu:build-site"
  module: string;                       // "blu"
  name: string;                         // "Build a Website"
  description: string;                  // "Generate a website from a description"
  
  // What this skill does
  busCommand: string;                   // "ai:generate-site" — skill invokes this bus command
  inputSchema: JSONSchema;              // What parameters the skill needs
  outputDescription: string;            // What the skill produces
  
  // Constraints
  requiredModules: string[];            // ["blu"] — modules that must be active
  requiredPlan?: string;                // Minimum plan
  aiCostEstimate: string;               // "low", "medium", "high" — for user expectation
}
```

### 12.4 Crew agent definition

```typescript
interface CrewAgentDefinition {
  id: string;                           // "accountant"
  name: string;                         // "Kitsy Accountant"
  role: string;                         // "Finance & Accounting Assistant"
  avatar: string;                       // Avatar image/illustration
  description: string;                  // "Manages invoices, tracks expenses, and generates financial reports"
  
  // Skills this agent has
  skills: string[];                     // ["finance:create-invoice", "finance:categorize-expense", "finance:monthly-report"]
  
  // What modules this agent needs
  requiredModules: string[];            // ["finance"]
  
  // Personality for LLM system prompt
  systemPrompt: string;                 // "You are a meticulous accountant who..."
  
  // Availability
  requiredPlan: string;                 // "pro"
}
```

### 12.5 Crew conversation flow

```
User opens Crew panel → sees available agents based on activated modules

User selects "Ops Manager" agent
User: "What's the status of the Q2 launch?"

Crew Manager:
  1. Routes to Ops Manager agent
  2. Assembles context from Knowledge Base:
     - Coop: Q2 Launch project (tasks, status, timeline)
     - Blu: Associated site deployment status
     - CRM: Client contacts related to launch (if CRM active)
  3. Builds LLM prompt with context + conversation history
  4. LLM generates response
  5. Response may include actions: "Want me to create a status report?"

User: "Yes, create a summary and send it to the team"

Crew Manager:
  1. Invokes skill: coop:standup-summary → generates summary
  2. Invokes skill: platform:send-email → sends to team
  3. Both actions are bus commands with full audit trail
```

### 12.6 Crew billing

```
Crew usage is metered per AI task:
  Simple tasks (draft email, categorize expense): 1 credit
  Medium tasks (generate report, build site section): 5 credits
  Complex tasks (full site generation, financial analysis): 10 credits

Plan credits/month:
  Starter: 10 credits (enough to try)
  Pro: 100 credits
  Business: 500 credits
  Enterprise: 2000 credits
  
Additional: $9 per 100 credits
```

---

## 13. Tech Infrastructure Offerings

### 13.1 CDN & Hosting

Initially for Blu-published sites. Future: general-purpose static hosting for tenant assets.

| Offering | Scope | Plan |
|----------|-------|------|
| kitsy.ai subdomain hosting | Blu sites | All plans |
| Custom domain hosting | Blu sites | Pro+ |
| Asset CDN | All module assets | All plans |
| Edge functions | Future: serverless compute at edge | Business+ |

### 13.2 Storage

```
Shared object storage (Cloudflare R2):
  /tenants/{tenantId}/
    ├── blu/          — site assets, deployment bundles
    ├── coop/         — project attachments, documents
    ├── crm/          — contact avatars, deal documents (future)
    ├── finance/      — invoice PDFs, receipts (future)
    ├── hrm/          — employee documents (future)
    └── shared/       — tenant-wide assets (logo, brand kit)
```

### 13.3 Compute & AI

| Offering | Current | Future |
|----------|---------|--------|
| AI generation (Mind) | LLM API calls for Blu site generation | Generalized across all modules |
| Crew AI tasks | Bus-mediated AI operations | Per-task billing |
| Background jobs | Publish pipeline, image optimization | Queue-based job processing for all modules |
| Scheduled tasks | — | Cron-like recurring tasks (reports, data sync) |

---

## 14. Cross-Module Data Flow

### 14.1 Entity references

Modules reference each other's entities through a lightweight reference protocol, not direct database joins:

```typescript
// A Coop project referencing a CRM contact (the client)
interface EntityReference {
  module: string;                       // "crm"
  entity: string;                       // "contact"
  id: string;                           // "contact-abc-123"
}

// Stored in Coop's project table as JSONB:
// { "client": { "module": "crm", "entity": "contact", "id": "contact-abc-123" } }

// When Coop needs to display the contact name:
// GET /api/v1/crm/contacts/contact-abc-123/summary
// → { id, name, email, avatar }  (lightweight, cached)
```

### 14.2 Cross-module search

```typescript
// Command palette and dashboard search:
// 1. User types query
// 2. Platform dispatches to each active module's search handler
// 3. Results aggregated and ranked

interface ModuleSearchResult {
  module: string;                       // "blu", "coop", "crm"
  entity: string;                       // "site", "project", "contact"
  id: string;
  title: string;                        // Display name
  subtitle?: string;                    // Secondary info
  icon: string;
  url: string;                          // Route to navigate to
  score: number;                        // Relevance score
}
```

### 14.3 Shared audit log

Every action across all modules is logged to a shared audit trail:

```sql
CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  user_id      TEXT,
  module       TEXT NOT NULL,             -- "blu", "coop", "crm", "crew", "platform"
  action       TEXT NOT NULL,             -- "site.published", "task.completed", "invoice.sent"
  entity_type  TEXT,                      -- "site", "task", "invoice"
  entity_id    TEXT,
  details      JSONB,
  source       TEXT,                      -- "user", "crew:accountant", "system"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_time ON audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_audit_module ON audit_log (tenant_id, module, created_at DESC);
```

---

## 15. Marketplace & Extensibility

### 15.1 What can be published to the marketplace

| Type | Description | Example |
|------|-------------|---------|
| **Templates** | Blu ApplicationConfiguration documents | SaaS landing page, portfolio site |
| **Plugins** | Blu plugins (components, effects, data adapters) | Analytics widget, chat widget |
| **Crew Skills** | Custom AI agent skills | Industry-specific AI workflows |
| **Integrations** | Third-party service connectors | Slack notifications, Stripe sync |
| **Modules** | Full third-party modules (future, Enterprise) | Custom industry-specific modules |

### 15.2 Third-party module SDK (future)

```typescript
// Third-party developers can build modules using the module contract:
import { defineModule } from "@kitsy/module-sdk";

export default defineModule({
  id: "inventory",
  name: "Inventory Management",
  version: "1.0.0",
  routes: [...],
  commands: [...],
  crewSkills: [...],
  migrations: "./migrations",
  // ...
});
```

This is a long-term extensibility play — the module contract (Section 5) is designed with this in mind, even though initial modules are all first-party.

---

## 16. Platform API

### 16.1 API structure

```
https://api.kitsy.ai/v1/

Platform-level endpoints:
  /auth/*                              — signup, login, token refresh
  /tenants/*                           — workspace management
  /team/*                              — team member management
  /billing/*                           — plans, subscriptions, usage
  /crew/*                              — AI agent interactions
  /search                              — cross-module search
  /audit                               — audit log queries
  /notifications                       — notification management

Module-scoped endpoints:
  /blu/*                               — Blu module API (sites, configs, publish, etc.)
  /coop/*                              — Coop module API (projects, tasks, boards, etc.)
  /crm/*                               — CRM module API (future)
  /finance/*                           — Finance module API (future)
  /hrm/*                               — HRM module API (future)
```

### 16.2 API authentication

All API calls use Bearer JWT tokens. Same token works across all module endpoints — the `modules` and `scopes` claims in the JWT determine access.

### 16.3 Webhooks

Tenants can configure webhook URLs to receive events from any module:

```typescript
// Webhook configuration
POST /api/v1/webhooks
{
  url: "https://myapp.com/kitsy-webhook",
  events: ["blu:site:published", "coop:task:completed", "crm:deal:won"],
  secret: "whsec_..."
}

// Webhook payload
{
  id: "evt_abc123",
  type: "crm:deal:won",
  tenantId: "tenant_xyz",
  data: { dealId: "deal_123", value: 5000 },
  timestamp: "2026-03-22T14:23:01Z",
  signature: "sha256=..."
}
```

---

## 17. Security Architecture

### 17.1 Security model layers

```
Layer 1: Network
  • TLS everywhere (HTTPS, WSS)
  • Cloudflare DDoS protection
  • API rate limiting at edge

Layer 2: Authentication
  • Supabase Auth (email, social, SSO)
  • JWT with short expiry (15 min) + refresh rotation
  • Token blacklisting on logout/revocation

Layer 3: Authorization
  • Platform roles (owner, admin, editor, viewer)
  • Module-specific scopes in JWT
  • Entitlement engine for plan-gated features

Layer 4: Tenant Isolation
  • Every database query scoped by tenant_id
  • Row Level Security on all tables
  • Bus commands tagged and filtered by tenant
  • Storage paths prefixed by tenant
  • Redis keys prefixed by tenant
  • Cross-tenant access impossible at every layer

Layer 5: Module Isolation
  • Modules can only dispatch commands in their own namespace
  • Cross-module subscriptions require explicit manifest declaration
  • Module API endpoints validate module access in JWT

Layer 6: AI Safety
  • Crew agents operate with user's permissions (no escalation)
  • All AI actions logged in audit trail with source="crew:{agent}"
  • Content safety filters on all AI outputs
  • AI cannot access modules the tenant hasn't activated
```

### 17.2 Data residency (Enterprise)

Enterprise tenants can specify data region. Database and storage are provisioned in the specified region. Bus commands are routed to region-local server instances.

---

## 18. Infrastructure & Deployment

### 18.1 Infrastructure map

```
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare                                                   │
│  ├── DNS (kitsy.ai, *.kitsy.ai, custom domains)              │
│  ├── CDN (published sites, static assets)                     │
│  ├── Pages (kitsy.ai dashboard web app)                       │
│  ├── R2 (object storage — all module assets)                  │
│  └── Workers (edge functions: image optimization, analytics)  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Fly.io                                                       │
│  ├── Kitsy Server (Node.js, WebSocket, multi-instance)       │
│  ├── Module Workers (background jobs per module)              │
│  └── Crew Workers (AI agent compute)                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Supabase                                                     │
│  ├── PostgreSQL (shared DB, all modules, RLS-isolated)       │
│  ├── Auth (identity provider)                                │
│  └── Realtime (future: live dashboards)                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Upstash                                                      │
│  └── Redis (session cache, pub/sub, rate limiting, queues)   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  External                                                     │
│  ├── Stripe (billing)                                        │
│  ├── Resend (transactional email)                            │
│  ├── Anthropic / OpenAI (AI compute for Mind + Crew)         │
│  └── Namecheap (domain registration — future)                │
└──────────────────────────────────────────────────────────────┘
```

### 18.2 Shared vs. module-specific infrastructure

| Component | Shared | Module-Specific |
|-----------|--------|----------------|
| Database | One PostgreSQL instance, module tables separated by naming + RLS | Modules define own tables via migrations |
| Redis | One Redis cluster, module keys separated by prefix (`blu:*`, `coop:*`) | Modules use own key prefixes |
| Object storage | One R2 bucket, tenant/module path separation | Modules use own path prefix |
| Server | One Kitsy Server binary handles all module bus commands | Modules register effects on shared bus |
| Web app | One SPA, modules lazy-loaded as code-split chunks | Modules provide own React entry components |

### 18.3 Deployment

```
Monorepo structure:
  kitsy/
  ├── packages/
  │   ├── platform/          — shared platform shell
  │   ├── server/            — Kitsy Server
  │   ├── modules/
  │   │   ├── blu/           — Blu module (links to Blu monorepo packages)
  │   │   ├── coop/          — Coop module
  │   │   └── crm/           — CRM module (future)
  │   ├── crew/              — Crew AI workforce
  │   └── shared/            — shared utilities, types, bus extensions
  └── infrastructure/
      ├── terraform/         — Cloudflare, Fly.io, Supabase config
      └── docker/            — Local development compose
```

---

## 19. Revenue Architecture

### 19.1 Revenue streams

| Stream | Description | Margin |
|--------|-------------|--------|
| **Platform subscriptions** | Monthly/yearly base plan (Starter, Pro, Business) | High (software) |
| **Module add-ons** | Per-user module pricing (CRM, Finance, HRM) | High |
| **Crew usage** | Per-credit AI task execution | Medium (LLM costs) |
| **Infrastructure** | Storage, bandwidth, compute overages | Medium |
| **Domain registration** | Pass-through with margin (Namecheap) | Low |
| **Marketplace** | Revenue share on third-party templates/plugins (future) | High (commission) |
| **Enterprise** | Custom pricing, SLA, dedicated infrastructure | High |

### 19.2 Growth model

```
PHASE 1 (Now): Blu as wedge
  Revenue: Blu subscriptions + AI credits
  Goal: Developer adoption of OSS framework → conversion to kitsy.ai

PHASE 2 (6-12 months): Coop adds project management
  Revenue: + Coop add-on subscriptions
  Goal: Existing Blu users adopt Coop for project management

PHASE 3 (12-24 months): CRM + Finance
  Revenue: + CRM and Finance add-ons
  Goal: Businesses consolidate more tools into Kitsy

PHASE 4 (24+ months): Full platform
  Revenue: + HRM, Crew AI workforce, marketplace, Enterprise
  Goal: Kitsy becomes the primary business operating system
```

### 19.3 Unit economics target

| Metric | Target |
|--------|--------|
| CAC (Customer Acquisition Cost) | < $50 (OSS funnel reduces this) |
| LTV (Lifetime Value) | > $500 (multi-module retention increases this) |
| Monthly churn | < 5% (cross-module lock-in reduces this) |
| Gross margin | > 70% (software + AI compute) |
| Break-even | ~50 Pro subscribers + 10 Business subscribers |

---

## 20. Platform Roadmap

### 20.1 Phased delivery

```
PHASE 1: Foundation (Months 1-3)
  ✅ Blu framework (OSS)
  ✅ Kitsy Server
  ✅ Studio + Mind
  ✅ Platform shell (auth, tenancy, billing, dashboard)
  ✅ Blu as first module with full hosting pipeline
  
  Deliverable: kitsy.ai launches with Blu module
  Revenue start: Blu subscriptions

PHASE 2: Second Module (Months 3-5)
  → Coop integration as second module
  → Module contract formalized from real two-module experience
  → Cross-module bus events (Coop ← Blu)
  → Crew v1 (Developer agent + Ops agent — skills from Blu + Coop)
  
  Deliverable: kitsy.ai with Blu + Coop
  Revenue: + Coop add-on

PHASE 3: Business Modules (Months 6-12)
  → CRM module
  → Finance module (invoicing first, accounting later)
  → Cross-module flows (deal won → invoice created)
  → Crew agents: Accountant, Sales Rep
  → Marketplace v1 (templates + plugins)
  
  Deliverable: kitsy.ai as multi-module business platform
  Revenue: + CRM, Finance add-ons, Crew credits

PHASE 4: Full Platform (Months 12-24)
  → HRM module
  → Advanced Crew agents
  → Third-party module SDK
  → Enterprise tier (SSO, data residency, SLA)
  → Tech infrastructure offerings (CDN, compute, storage as service)
  
  Deliverable: kitsy.ai as AI-native business OS
  Revenue: full multi-stream model
```

### 20.2 What to build when

| Component | When | Depends On |
|-----------|------|-----------|
| Platform shell (auth, tenant, dashboard) | Phase 1 | Supabase, Cloudflare |
| Module contract formalization | Phase 1 (design), Phase 2 (validate) | Blu + Coop as two real modules |
| Shared billing + entitlements | Phase 1 | Stripe |
| Cross-module bus events | Phase 2 | Module contract + two modules |
| Crew v1 | Phase 2 | Mind engine + module skills |
| Knowledge Base | Phase 2-3 | Multiple modules providing data |
| Marketplace | Phase 3 | Enough modules/templates to matter |
| Third-party module SDK | Phase 4 | Stable module contract from 3+ modules |

---

## 21. Key Architectural Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| PAD-001 | Module architecture | Module contract with manifest | Enables N modules without shell changes |
| PAD-002 | Inter-module communication | EventBus (not REST between modules) | Lowest coupling, native real-time, AI-equal |
| PAD-003 | Database strategy | Shared PostgreSQL, module tables + RLS | Simpler ops than DB-per-module; RLS enforces isolation |
| PAD-004 | AI architecture | Crew agents with cross-module skills | AI operates across module boundaries — not siloed per product |
| PAD-005 | Billing model | Platform base + module add-ons | Businesses buy what they need; not all-or-nothing |
| PAD-006 | Module loading | Lazy-loaded code-split chunks in SPA | Fast initial load; modules loaded on demand |
| PAD-007 | Entity references | Lightweight reference protocol (not joins) | Modules stay decoupled; can exist independently |
| PAD-008 | Audit trail | Shared audit_log across all modules | Single source for compliance, activity feed, AI context |
| PAD-009 | Search | Per-module search handlers, aggregated results | Each module knows its own data best |
| PAD-010 | First module | Blu (websites) | Widest TAM, developer funnel via OSS, proves bus architecture |
| PAD-011 | Second module | Coop (projects) | Already built; validates module contract with real second product |
| PAD-012 | Crew agents | Named personas with multi-module skills | More intuitive than "AI features"; aligns with "hire a worker" mental model |

---

## Document Relationships

```
THIS DOCUMENT (Kitsy Platform Architecture)
  ├── defines the shell that everything plugs into
  ├── defines the module contract
  ├── defines shared infrastructure
  └── defines Crew AI workforce model

PRODUCT-SPECIFIC DOCUMENTS (each describes one module):
  ├── docs/blu/ (foundation,       → Blu module (websites)
  │   architecture, specification,
  │   shell, execution)
  ├── Blu Component Specifications → Blu UI components
  ├── Kitsy Server Spec            → Shared server infrastructure (used by all modules)
  ├── Kitsy Studio Spec            → Blu visual builder
  ├── Kitsy Mind Spec              → AI engine (used by Crew, initially Blu-focused)
  ├── Blu Product Hosting Spec     → Blu-specific SaaS features (publish, domains, analytics)
  └── Coop Spec                    → Coop module (separate document, not covered here)

FUTURE DOCUMENTS (as modules ship):
  ├── CRM Module Spec
  ├── Finance Module Spec
  ├── HRM Module Spec
  └── Crew Implementation Spec
```

---

*Kitsy is the operating system. Modules are the apps. Crew is the workforce. The bus is the nervous system.*
