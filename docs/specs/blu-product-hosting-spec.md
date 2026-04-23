# Blu Product Hosting — Implementation Specification

**Status:** Canonical — implementation specification for the Blu hosted product
**Scope:** Blu-specific SaaS features within the Kitsy platform — site management, publish pipeline, domains, analytics, templates. This document covers the Blu MODULE's hosting and delivery capabilities, NOT the platform shell itself.
**License:** Proprietary (SaaS — Terms of Service)
**Read first:** `docs/blu/foundation.md`, `docs/blu/architecture.md`, `docs/blu/specification.md`, `docs/reference/kitsy-platform-architecture.md` (the module-agnostic shell), `docs/specs/kitsy-server-implementation-spec.md`, `docs/specs/kitsy-studio-implementation-spec.md`, `docs/specs/kitsy-mind-implementation-spec.md`
**Note:** The Kitsy Platform Architecture document defines the shared platform shell (auth, tenancy, billing, dashboard, module contract, Crew). This document covers only the Blu-specific features that plug INTO that shell.

---

## Table of Contents

1. [Overview & Product Goals](#1-overview--product-goals)
2. [System Architecture](#2-system-architecture)
3. [Application Structure](#3-application-structure)
4. [Authentication & Identity](#4-authentication--identity)
5. [Tenant & Workspace Management](#5-tenant--workspace-management)
6. [Dashboard](#6-dashboard)
7. [Site Management](#7-site-management)
8. [Publish Pipeline](#8-publish-pipeline)
9. [Domain Management](#9-domain-management)
10. [Asset Management](#10-asset-management)
11. [Billing & Subscription](#11-billing--subscription)
12. [Analytics](#12-analytics)
13. [Template Marketplace](#13-template-marketplace)
14. [Onboarding Flow](#14-onboarding-flow)
15. [Settings & Administration](#15-settings--administration)
16. [Email & Notifications](#16-email--notifications)
17. [API Layer](#17-api-layer)
18. [Frontend Architecture](#18-frontend-architecture)
19. [Infrastructure & Deployment](#19-infrastructure--deployment)
20. [Implementation Sequence](#20-implementation-sequence)

---

## 1. Overview & Product Goals

kitsy.ai is the SaaS product surface — what a business user interacts with. It is the application that stitches together Blu (rendering), Server (sync/state), Studio (visual builder), and Mind (AI) into a coherent product experience.

### 1.1 What kitsy.ai delivers

A business user signs up at kitsy.ai and can:

1. **Create a site** from a template, from AI prompt, or from scratch in Studio
2. **Edit their site** visually in Studio or conversationally via Mind
3. **Publish their site** to a kitsy subdomain or custom domain
4. **Manage their business** — analytics, basic CRM (future), email (future)
5. **Upgrade their plan** for more features, sites, AI usage, custom domains

### 1.2 Design goals

| Goal | Constraint |
|------|-----------|
| **Zero to published in < 5 minutes** | New user → template → AI customization → publish. Entire flow in one session. |
| **Studio-first** | Every site management action routes through or is accessible from Studio. Dashboard is the launchpad; Studio is where work happens. |
| **Self-serve** | Everything from signup to publish to billing is self-serve. No human intervention required for Starter/Pro/Business tiers. |
| **Multi-tenant** | Every data path is tenant-scoped (Server Spec §11). No shared state leakage. |
| **Built on Blu** | kitsy.ai itself is a Blu app. The dashboard, onboarding, settings — all rendered via the Blu framework. Eating our own cooking at the product level. |

### 1.3 User personas

| Persona | Description | Plan | Primary Path |
|---------|-------------|------|-------------|
| **Solo Builder** | Individual launching a personal site, portfolio, or side project | Starter (free) | Template → AI customize → publish on kitsy subdomain |
| **Small Business** | Local business wanting online presence | Pro | Template → Studio edit → publish on custom domain |
| **Agency/Freelancer** | Building sites for clients | Business | Multi-site, manage across clients |
| **Developer** | Integrating Blu into own stack, using platform for hosting | Pro/Business | API-driven, config upload, CLI publish |
| **Enterprise** | Large org needing self-hosted or white-label | Enterprise | Custom deployment, SSO, SLA |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          kitsy.ai                                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Web Application (Blu App)                     │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐ │ │
│  │  │ Dashboard  │ │ Studio    │ │ Settings  │ │ Marketplace   │ │ │
│  │  │ (sites,    │ │ (visual   │ │ (billing, │ │ (templates,   │ │ │
│  │  │  analytics)│ │  editor)  │ │  team,    │ │  plugins)     │ │ │
│  │  │           │ │           │ │  domains) │ │               │ │ │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬───────┘ │ │
│  │        └──────────────┴──────────────┴───────────────┘         │ │
│  └────────────────────────────────┬───────────────────────────────┘ │
│                                   │                                  │
│  ┌────────────────────────────────▼───────────────────────────────┐ │
│  │                    Platform API Layer                           │ │
│  │  (REST + GraphQL endpoints for all platform operations)         │ │
│  └──────────┬──────────────┬──────────────┬───────────────────────┘ │
│             │              │              │                          │
│  ┌──────────▼──────┐ ┌────▼────┐ ┌──────▼──────────────┐          │
│  │  Kitsy Server    │ │ Service │ │ External Integrations│          │
│  │  (sync, state,   │ │ Layer   │ │                     │          │
│  │   config, auth)  │ │         │ │ • Stripe (billing)  │          │
│  │                  │ │ • Publish│ │ • Cloudflare (CDN)  │          │
│  │                  │ │ • Domain │ │ • Namecheap (domain)│          │
│  │                  │ │ • Asset  │ │ • Resend (email)    │          │
│  │                  │ │ • Email  │ │ • Supabase (DB)     │          │
│  │                  │ │ • Notify │ │ • R2 (storage)      │          │
│  └──────────────────┘ └─────────┘ └─────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Application Structure

kitsy.ai is a single-page application built with Blu, served from `kitsy.ai`.

### 3.1 Route structure

```
/                           → Marketing landing page (public)
/login                      → Login / signup
/signup                     → Signup flow
/onboarding                 → First-time user onboarding wizard

/dashboard                  → Site list, quick stats, recent activity
/dashboard/sites            → All sites list
/dashboard/analytics        → Cross-site analytics

/site/:siteId/studio        → Studio editor (full-screen)
/site/:siteId/settings      → Site settings (domain, meta, permissions)
/site/:siteId/analytics     → Site-specific analytics
/site/:siteId/deployments   → Deployment history

/marketplace                → Template and plugin marketplace
/marketplace/templates      → Browse templates
/marketplace/plugins        → Browse plugins (future)

/settings                   → Account settings
/settings/profile           → User profile
/settings/team              → Team members (Business+)
/settings/billing           → Plan and payment
/settings/domains           → Domain management
/settings/api               → API keys and webhooks (Developer)

/admin                      → Platform admin (internal only)
```

### 3.2 Navigation model

```
┌─────────────────────────────────────────────────────────┐
│  kitsy.ai                    [Sites ▾] [? Help] [Avatar]│
├───────────┬─────────────────────────────────────────────┤
│           │                                             │
│  Dashboard│  [Site list / analytics / activity]          │
│  Sites    │                                             │
│  Templates│                                             │
│  Settings │                                             │
│           │                                             │
│           │                                             │
└───────────┴─────────────────────────────────────────────┘

Studio view (full-screen, hides platform nav):
┌─────────────────────────────────────────────────────────┐
│  ← Back to Dashboard    My Bakery Site    [Preview] [▶]  │
├─────────────────────────────────────────────────────────┤
│  [Studio full-screen UI — see Studio Spec]               │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Authentication & Identity

### 4.1 Auth provider

**Supabase Auth** — email/password, magic link, social OAuth (Google, GitHub).

Future: SAML/SSO for Enterprise tier.

### 4.2 Auth flow

```
1. User signs up → Supabase creates auth user
2. Platform creates tenant record + links user as owner
3. JWT issued with claims: { sub: userId, tid: tenantId, roles: ["owner"], plan: "starter" }
4. JWT used for both Platform API and Kitsy Server WebSocket
5. Token refresh: 15-minute access token + 7-day refresh token (Server Spec §6.4)
```

### 4.3 User model

```sql
-- Users (Supabase auth.users handles core identity)
-- Platform extends with:
CREATE TABLE user_profiles (
  id            TEXT PRIMARY KEY REFERENCES auth.users(id),
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant membership (users can belong to multiple tenants)
CREATE TABLE tenant_members (
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  user_id       TEXT NOT NULL REFERENCES user_profiles(id),
  role          TEXT NOT NULL DEFAULT 'editor',  -- owner, admin, editor, viewer
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, user_id)
);
```

### 4.4 Role permissions

| Role | Sites | Studio | Publish | Settings | Billing | Team |
|------|-------|--------|---------|----------|---------|------|
| Owner | CRUD | Full | ✅ | Full | Full | Full |
| Admin | CRUD | Full | ✅ | Read/Write | Read | Invite |
| Editor | Read/Write | Full | ❌ | Read | ❌ | ❌ |
| Viewer | Read | Read-only preview | ❌ | ❌ | ❌ | ❌ |

---

## 5. Tenant & Workspace Management

### 5.1 Tenant model

```sql
CREATE TABLE tenants (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,           -- for kitsy subdomain: {slug}.kitsy.ai
  plan            TEXT NOT NULL DEFAULT 'starter',
  plan_period     TEXT DEFAULT 'monthly',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Limits
  max_sites       INTEGER NOT NULL DEFAULT 1,     -- starter: 1, pro: 5, business: 20
  max_team_members INTEGER NOT NULL DEFAULT 1,    -- starter: 1, pro: 3, business: 10
  ai_requests_remaining INTEGER NOT NULL DEFAULT 10,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  storage_limit_bytes BIGINT NOT NULL DEFAULT 104857600, -- 100MB starter
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Plan limits

| Limit | Starter | Pro | Business | Enterprise |
|-------|---------|-----|----------|------------|
| Sites | 1 | 5 | 20 | Unlimited |
| Custom domains | 0 | 1 per site | 1 per site | Unlimited |
| Team members | 1 | 3 | 10 | Unlimited |
| Storage | 100MB | 1GB | 10GB | Custom |
| AI requests/month | 10 | 100 | 500 | 2000 |
| Config version history | 10 | 50 | 100 | Unlimited |
| Analytics retention | 7 days | 30 days | 90 days | 1 year |
| Server-managed state | ❌ | ✅ | ✅ | ✅ |
| Collaboration | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ | ✅ + SLA |

---

## 6. Dashboard

### 6.1 Dashboard home

```
┌─────────────────────────────────────────────────────────┐
│  Good morning, Prashant                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Quick Actions                                       ││
│  │  [+ New Site]  [📋 Templates]  [🤖 AI Create]       ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  Your Sites                                [View All →] │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│  │ 🌐        │ │ 🌐        │ │ + Create  │            │
│  │ My Bakery │ │ Portfolio │ │   New     │            │
│  │ bakery.   │ │ prashant. │ │   Site    │            │
│  │ kitsy.ai  │ │ kitsy.ai  │ │           │            │
│  │           │ │           │ │           │            │
│  │ Published │ │ Draft     │ │           │            │
│  │ [Edit]    │ │ [Edit]    │ │           │            │
│  └───────────┘ └───────────┘ └───────────┘            │
│                                                         │
│  Recent Activity                                        │
│  • Published "My Bakery" — 2 hours ago                  │
│  • AI generated pricing section — yesterday             │
│  • Created "Portfolio" — 3 days ago                     │
│                                                         │
│  Quick Stats (Pro+)                                     │
│  Page Views: 1,234 this week  │  Visitors: 456          │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Site card data

```typescript
interface SiteCardData {
  siteId: string;
  name: string;
  subdomain: string;                    // bakery.kitsy.ai
  customDomain?: string;                // mybakery.com
  status: "draft" | "published" | "archived";
  thumbnail?: string;                   // Auto-generated screenshot
  lastEditedAt: number;
  lastPublishedAt?: number;
  pageCount: number;
  configVersion: number;
}
```

---

## 7. Site Management

### 7.1 Create site flow

```
Option A: From Template
  1. Browse template gallery
  2. Preview template
  3. Click "Use This" → new site created with template config
  4. Redirect to Studio for customization

Option B: AI Create
  1. Prompt: "Create a landing page for my bakery"
  2. Kitsy Mind generates config
  3. Preview generated site
  4. Click "Apply" → new site created
  5. Redirect to Studio for refinement

Option C: Blank
  1. Click "New Blank Site"
  2. Enter site name
  3. Redirect to Studio with empty config
```

### 7.2 Site settings page

```
Site Settings: My Bakery
├── General
│   ├── Name: [My Bakery]
│   ├── Subdomain: [bakery].kitsy.ai
│   └── Description: [...]
├── SEO & Meta
│   ├── Title: [...]
│   ├── Description: [...]
│   ├── OG Image: [upload]
│   └── Favicon: [upload]
├── Domain (Pro+)
│   ├── Custom Domain: [mybakery.com]
│   ├── DNS Status: [✅ Connected]
│   └── SSL: [✅ Active]
├── Publishing
│   ├── Status: [Published ✅]
│   ├── Last published: 2 hours ago (v23)
│   ├── [Publish Now] [Unpublish]
│   └── Deployment history →
├── Permissions (Business+)
│   ├── Team access: [Editor: Alice, Viewer: Bob]
│   └── [Manage Access]
└── Danger Zone
    ├── [Archive Site]
    └── [Delete Site]
```

### 7.3 Site data model

```sql
-- Extends Server Spec §16 sites table
CREATE TABLE sites (
  id              TEXT NOT NULL,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  name            TEXT NOT NULL,
  subdomain       TEXT UNIQUE,
  custom_domain   TEXT UNIQUE,
  
  -- SEO
  meta_title      TEXT,
  meta_description TEXT,
  og_image_url    TEXT,
  favicon_url     TEXT,
  
  -- Status
  status          TEXT NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMPTZ,
  published_version INTEGER,
  
  -- Template origin
  template_id     TEXT,                           -- Which template this was created from
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);
```

---

## 8. Publish Pipeline

### 8.1 Publish flow

```
User clicks "Publish" in Studio or Site Settings
    ↓
Platform API: POST /api/v1/publish/:siteId
    ↓
┌─────────────────────────────────────────┐
│  Publish Pipeline                        │
│                                         │
│  1. Load latest config from ConfigStore  │
│  2. Validate config (full pipeline)      │
│  3. Run @kitsy/blu-shell compile    │
│  4. Render each view via renderToString  │
│     SSR() → static HTML                  │
│  5. Generate CSS via CssBuilder          │
│  6. Collect assets (images, fonts)       │
│  7. Bundle: HTML + CSS + JS + assets     │
│  8. Upload bundle to CDN (R2/S3)         │
│  9. Configure DNS if custom domain       │
│  10. Invalidate CDN cache                │
│  11. Update site status → "published"    │
│  12. Record deployment in deployments    │
│      table                              │
│                                         │
│  For server-managed sites (Pro+):        │
│  • Also deploy to Kitsy Server for       │
│    WebSocket + real-time features        │
│  • Static HTML serves as fallback        │
│    (hydration on connection)             │
└─────────────────────────────────────────┘
    ↓
Site is live at {subdomain}.kitsy.ai (and custom domain if configured)
```

### 8.2 Deployment record

```sql
CREATE TABLE deployments (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  site_id           TEXT NOT NULL,
  config_version    INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  
  -- Build info
  build_started_at  TIMESTAMPTZ,
  build_completed_at TIMESTAMPTZ,
  build_duration_ms INTEGER,
  
  -- Output
  cdn_url           TEXT,
  bundle_size_bytes INTEGER,
  page_count        INTEGER,
  
  -- Errors
  error_message     TEXT,
  error_details     JSONB,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id)
);
```

### 8.3 Deployment targets

| Plan | Static CDN | Server-Managed | Custom Domain |
|------|-----------|---------------|---------------|
| Starter | ✅ kitsy subdomain | ❌ | ❌ |
| Pro | ✅ | ✅ | ✅ (1 per site) |
| Business | ✅ | ✅ | ✅ (1 per site) |
| Enterprise | ✅ | ✅ (dedicated) | ✅ (unlimited) |

### 8.4 CDN architecture

```
Published site serving:

  User visits mybakery.com
    ↓
  Cloudflare CDN edge (cached static assets)
    ↓ (cache miss)
  R2 bucket: /tenants/{tenantId}/sites/{siteId}/v{version}/
    ├── index.html           (SSR'd HTML, includes Blu bootstrap)
    ├── styles.css           (CssBuilder output)
    ├── config.json          (ApplicationConfiguration for client hydration)
    ├── blu.min.js           (Blu runtime — if not using CDN)
    └── assets/
        ├── images/
        └── fonts/

  If server-managed (Pro+):
    HTML includes: <script>Blu.render(config, { platform: "kitsy", endpoint: "wss://rt.kitsy.ai" })</script>
    → Hydrates static HTML into live Blu app with real-time features
    
  If static only (Starter):
    HTML includes: <script>Blu.render(config)</script>
    → Hydrates into client-only Blu app
```

---

## 9. Domain Management

### 9.1 Subdomain (all plans)

Every site gets a free subdomain: `{slug}.kitsy.ai`

- Slug is unique across all tenants
- Set during site creation
- DNS managed by Kitsy (wildcard *.kitsy.ai → CDN)
- HTTPS automatic via Cloudflare

### 9.2 Custom domain (Pro+)

```
Custom Domain Setup Flow:

1. User enters domain: mybakery.com
2. Platform checks availability (optional: register via Namecheap)
3. Platform shows DNS instructions:
   
   "Add these records to your domain's DNS settings:
   
   Type    Name    Value
   CNAME   @       sites.kitsy.ai
   CNAME   www     sites.kitsy.ai
   TXT     @       kitsy-verify=abc123
   "

4. Platform polls for DNS propagation (check every 60s, timeout 48h)
5. Once verified: provision SSL certificate (Cloudflare origin cert or Let's Encrypt)
6. Domain active → site served at custom domain
```

### 9.3 Domain data model

```sql
CREATE TABLE domains (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  site_id         TEXT NOT NULL,
  domain          TEXT UNIQUE NOT NULL,           -- mybakery.com
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, verifying, active, failed
  verification_token TEXT NOT NULL,
  ssl_status      TEXT DEFAULT 'pending',          -- pending, provisioning, active
  dns_verified_at TIMESTAMPTZ,
  ssl_provisioned_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id)
);
```

### 9.4 Domain registration (optional, future)

For users who don't have a domain, kitsy.ai can offer registration via Namecheap API:

```
1. User searches: "mybakery.com"
2. Platform: check("mybakery.com") → { available: true, price: 12.99/yr }
3. User purchases → Namecheap registers → DNS auto-configured
4. Zero-friction: domain → site in one step
```

---

## 10. Asset Management

### 10.1 Asset storage

```
Storage structure:
  /tenants/{tenantId}/
    ├── sites/{siteId}/
    │   ├── assets/                    # Site-specific assets
    │   │   ├── images/
    │   │   ├── fonts/
    │   │   └── files/
    │   └── deployments/               # Published bundles
    │       └── v{version}/
    └── shared/                        # Tenant-wide assets (logo, brand)
        ├── images/
        └── fonts/
```

### 10.2 Asset upload

```typescript
// Upload API
POST /api/v1/assets/:siteId/upload
  Content-Type: multipart/form-data
  Body: file, folder (optional)
  
  → { url, key, size, contentType }

// Presigned URL for direct upload (large files)
POST /api/v1/assets/:siteId/presign
  Body: { filename, contentType, size }
  
  → { uploadUrl, key, expiresIn }
```

### 10.3 Image optimization

All uploaded images are automatically processed:

1. **Resize:** Generate responsive variants (320w, 640w, 1024w, 1920w)
2. **Format:** Convert to WebP (with JPEG/PNG fallback)
3. **Compression:** Quality 80 for photos, lossless for graphics
4. **CDN URL:** `cdn.kitsy.ai/tenants/{tid}/sites/{sid}/assets/images/{key}-{width}w.webp`

### 10.4 Storage limits

| Plan | Limit | Enforcement |
|------|-------|-------------|
| Starter | 100MB | Reject upload if exceeded |
| Pro | 1GB | Reject upload if exceeded |
| Business | 10GB | Reject upload if exceeded |
| Enterprise | Custom | Configurable |

---

## 11. Billing & Subscription

### 11.1 Stripe integration

```typescript
// Stripe service (Platform API)
interface BillingService {
  // Customer
  createCustomer(tenantId: string, email: string): Promise<string>;  // Returns Stripe customer ID
  
  // Subscription
  createSubscription(tenantId: string, planId: string, period: "monthly" | "yearly"): Promise<Subscription>;
  updateSubscription(tenantId: string, newPlanId: string): Promise<Subscription>;
  cancelSubscription(tenantId: string): Promise<void>;
  
  // Portal
  createPortalSession(tenantId: string): Promise<string>;  // Returns Stripe Customer Portal URL
  
  // Usage
  reportUsage(tenantId: string, metric: string, quantity: number): Promise<void>;
  
  // Webhooks
  handleWebhook(event: Stripe.Event): Promise<void>;
}
```

### 11.2 Stripe products

```
Products:
  kitsy-starter     → Free (no Stripe subscription)
  kitsy-pro         → $19/mo or $190/yr (save $38)
  kitsy-business    → $99/mo or $990/yr (save $198)
  kitsy-enterprise  → Custom quote

Add-ons (future):
  kitsy-ai-pack     → Additional 100 AI requests: $9
  kitsy-domain      → Domain registration: $12.99/yr (pass-through)
  kitsy-storage     → Additional 5GB: $5/mo
```

### 11.3 Webhook handling

```typescript
async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
      await activatePlan(event.data.object);
      break;
    case "customer.subscription.updated":
      await updatePlanLimits(event.data.object);
      break;
    case "customer.subscription.deleted":
      await downgradeToPlan("starter", event.data.object.metadata.tenantId);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailure(event.data.object);
      break;
    case "invoice.paid":
      await clearPaymentFailure(event.data.object);
      break;
  }
}
```

### 11.4 Plan enforcement

```typescript
// Middleware on every plan-gated action
async function enforcePlanLimits(tenantId: string, action: PlanGatedAction): Promise<void> {
  const tenant = await getTenant(tenantId);
  const limits = PLAN_LIMITS[tenant.plan];

  switch (action.type) {
    case "create-site":
      const siteCount = await countSites(tenantId);
      if (siteCount >= limits.maxSites) throw new PlanError("SITE_LIMIT", tenant.plan);
      break;
    case "ai-request":
      if (tenant.ai_requests_remaining <= 0) throw new PlanError("AI_QUOTA", tenant.plan);
      break;
    case "add-domain":
      if (tenant.plan === "starter") throw new PlanError("PLAN_REQUIRED", "pro");
      break;
    case "upload-asset":
      if (tenant.storage_used_bytes + action.size > limits.storageLimit) throw new PlanError("STORAGE_LIMIT", tenant.plan);
      break;
  }
}
```

### 11.5 Billing page UI

```
Billing & Plans
├── Current Plan: Pro ($19/mo)
│   ├── Next billing: April 22, 2026
│   ├── [Manage Payment Method]
│   └── [Switch to Yearly (save $38/yr)]
├── Usage This Period
│   ├── Sites: 3 / 5
│   ├── Storage: 234MB / 1GB
│   ├── AI Requests: 47 / 100
│   └── Team Members: 2 / 3
├── Plan Comparison
│   ├── [Starter: Free]  [Pro: $19]  [Business: $99]
│   └── [Contact Sales for Enterprise]
└── Invoice History
    ├── Mar 22, 2026 — $19.00 — Paid ✅
    ├── Feb 22, 2026 — $19.00 — Paid ✅
    └── [View All Invoices]
```

---

## 12. Analytics

### 12.1 Analytics data collection

Published Blu sites include a lightweight analytics script that reports page views and basic engagement:

```typescript
// Injected into published site HTML
// Reports via bus command (if server-managed) or HTTP beacon (if static)

interface AnalyticsEvent {
  type: "pageview" | "click" | "scroll" | "form_submit" | "custom";
  siteId: string;
  viewId: string;                       // Which page/view
  timestamp: number;
  sessionId: string;                    // Anonymous session
  
  // Page view specific
  path?: string;
  referrer?: string;
  userAgent?: string;
  screenWidth?: number;
  country?: string;                     // From CDN edge geolocation
  
  // Interaction specific
  nodeId?: string;                      // Which ViewNode was clicked
  eventName?: string;                   // Custom event name
}
```

### 12.2 Analytics storage

```sql
-- Partitioned by month for efficient queries and retention cleanup
CREATE TABLE analytics_events (
  id              BIGSERIAL,
  tenant_id       TEXT NOT NULL,
  site_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  view_id         TEXT,
  path            TEXT,
  referrer         TEXT,
  country         TEXT,
  session_id      TEXT,
  screen_width    INTEGER,
  node_id         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
-- Starter: retain 7 days, Pro: 30 days, Business: 90 days
```

### 12.3 Analytics dashboard

```
Analytics: My Bakery
├── Period: [Last 7 days ▾]
├── Overview
│   ├── Page Views:    1,234   (+12% vs prior period)
│   ├── Unique Visitors: 456   (+8%)
│   ├── Avg Time:      2m 14s  (+5%)
│   └── Bounce Rate:   42%     (-3%)
├── Pages
│   ├── /          — 678 views
│   ├── /menu      — 312 views
│   └── /contact   — 244 views
├── Referrers
│   ├── Google     — 45%
│   ├── Direct     — 30%
│   └── Instagram  — 15%
├── Geography
│   ├── India      — 65%
│   ├── US         — 20%
│   └── UK         — 8%
└── Devices
    ├── Mobile     — 58%
    ├── Desktop    — 35%
    └── Tablet     — 7%
```

---

## 13. Template Marketplace

### 13.1 Template model

```sql
CREATE TABLE marketplace_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,           -- landing, business, portfolio, storefront, etc.
  tags            TEXT[] NOT NULL,
  thumbnail_url   TEXT NOT NULL,
  preview_url     TEXT,                    -- Live preview URL
  
  -- Content
  config          JSONB NOT NULL,           -- ApplicationConfiguration
  type            TEXT NOT NULL,            -- site, page, section
  
  -- Author
  author_tenant_id TEXT,                   -- null for Kitsy-authored templates
  author_name     TEXT NOT NULL,
  
  -- Stats
  use_count       INTEGER NOT NULL DEFAULT 0,
  rating_avg      NUMERIC(3,2),
  rating_count    INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status          TEXT NOT NULL DEFAULT 'draft', -- draft, review, published, rejected
  featured        BOOLEAN NOT NULL DEFAULT false,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 13.2 Marketplace UI

```
Template Marketplace
├── Featured Templates
│   └── [3-4 featured template cards with thumbnails]
├── Categories
│   ├── Landing Pages (12)
│   ├── Business Sites (8)
│   ├── Portfolios (6)
│   ├── Storefronts (4)
│   └── Dashboards (3)
├── Search: [_____________]
├── Filter: [Category ▾] [Sort: Popular ▾]
└── Template Grid
    ├── [Template Card: thumbnail + name + category + use count + preview button]
    └── ...
```

### 13.3 Template lifecycle

```
Author creates template in Studio
  → Saves as template (stored in their tenant)
  → Submits to marketplace (status: review)
  → Kitsy team reviews (automated validation + manual quality check)
  → Approved → status: published
  → Users can browse, preview, and fork
```

---

## 14. Onboarding Flow

### 14.1 First-time user experience

```
Step 1: Welcome
  "Welcome to Kitsy! Let's create your first site."
  
Step 2: Choose Path
  [📋 Start from Template]  [🤖 AI Create]  [✏️ Start Blank]
  
Step 3a: Template Path
  → Browse templates → Select → Name site → Redirect to Studio
  
Step 3b: AI Path
  → "Describe your site:" [_______________________]
  → "What's your business?" [Bakery ▾]
  → "Choose a style:" [Modern] [Minimal] [Bold] [Playful]
  → AI generates → Preview → "Looks good!" → Redirect to Studio
  
Step 3c: Blank Path
  → Name site → Redirect to Studio

Step 4: Studio Tour (optional)
  Guided overlay highlighting: palette, canvas, properties, preview, publish
  
Step 5: Publish CTA
  After first edit: "Ready to go live? [Publish to {slug}.kitsy.ai]"
```

### 14.2 Onboarding state

```typescript
interface OnboardingState {
  completedSteps: string[];             // ["welcome", "create-site", "first-edit", "publish"]
  skippedTour: boolean;
  firstSiteId?: string;
  creationMethod?: "template" | "ai" | "blank";
}

// Stored in user_profiles.onboarding_state JSONB column
```

---

## 15. Settings & Administration

### 15.1 Account settings

| Section | Fields |
|---------|--------|
| Profile | Display name, email, avatar, password change |
| Notifications | Email preferences (publish alerts, usage warnings, newsletters) |
| API Keys | Generate/revoke API keys for programmatic access (Developer use case) |
| Connected Accounts | OAuth connections (Google, GitHub) |
| Data Export | Download all site configs as JSON (GDPR compliance) |
| Delete Account | Confirmation flow → cancel subscription → archive data → delete |

### 15.2 Team settings (Business+)

```
Team Members
├── Prashant (Owner)     prashant@heypkv.com    [Owner — cannot change]
├── Nishi (Editor)       nishi@heypkv.com       [Role: Editor ▾] [Remove]
├── Vivek (Editor)       vivek@heypkv.com       [Role: Editor ▾] [Remove]
└── [+ Invite Team Member]

Invite Modal:
  Email: [_____________]
  Role: [Editor ▾]
  Sites: [All Sites ▾] or [Specific Sites...]
  [Send Invite]
```

### 15.3 API keys

```
API Keys
├── Production: pk_live_***************abc    Created: Mar 1, 2026    [Revoke]
├── Development: pk_test_***************xyz   Created: Feb 15, 2026   [Revoke]
└── [+ Create New Key]

Webhook URL: https://myapp.com/webhooks/kitsy
Events: [✓ site.published] [✓ config.updated] [ ] billing.changed]
```

---

## 16. Email & Notifications

### 16.1 Transactional emails

| Trigger | Template | Provider |
|---------|----------|----------|
| Sign up | Welcome email | Resend |
| Team invite | Invitation with accept link | Resend |
| Site published | "Your site is live!" with URL | Resend |
| Plan upgrade | Confirmation + new limits | Resend |
| Payment failed | "Update payment method" with portal link | Resend |
| Usage warning | "80% of AI requests used" | Resend |
| Export ready | "Your data export is ready to download" | Resend |

### 16.2 In-app notifications

```typescript
interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  action?: { label: string; url: string };
  read: boolean;
  createdAt: number;
}
```

Notifications display in a dropdown from the header bell icon.

---

## 17. API Layer

### 17.1 Platform REST API

All platform operations are available via REST API for developer users and future mobile apps.

```
Authentication: Bearer token (JWT)
Base URL: https://api.kitsy.ai/v1

// Sites
GET    /sites                          → List sites
POST   /sites                          → Create site
GET    /sites/:id                      → Get site details
PATCH  /sites/:id                      → Update site settings
DELETE /sites/:id                      → Delete site

// Config
GET    /sites/:id/config               → Get current config
PUT    /sites/:id/config               → Upload config (full replace)
PATCH  /sites/:id/config               → Patch config (JSON Patch)
GET    /sites/:id/config/versions      → Version history
POST   /sites/:id/config/rollback      → Rollback

// Publish
POST   /sites/:id/publish              → Trigger publish
GET    /sites/:id/deployments          → Deployment history

// Assets
POST   /sites/:id/assets/upload        → Upload asset
GET    /sites/:id/assets               → List assets
DELETE /sites/:id/assets/:key          → Delete asset

// Domains
GET    /domains                        → List domains
POST   /domains                        → Add custom domain
GET    /domains/:id/status             → DNS/SSL verification status
DELETE /domains/:id                    → Remove domain

// AI
POST   /ai/generate                    → Generate config from prompt
POST   /ai/edit                        → Edit config section
POST   /ai/theme                       → Suggest theme

// Analytics
GET    /sites/:id/analytics            → Analytics data (with date range, granularity)

// Team
GET    /team                           → List team members
POST   /team/invite                    → Invite member
PATCH  /team/:userId                   → Update role
DELETE /team/:userId                   → Remove member

// Billing
GET    /billing                        → Current plan + usage
POST   /billing/portal                 → Get Stripe portal URL
```

### 17.2 Webhook events

```typescript
interface WebhookEvent {
  id: string;
  type: string;
  tenantId: string;
  data: unknown;
  createdAt: number;
}

// Event types:
// site.created, site.published, site.deleted
// config.updated, config.rollback
// team.member_added, team.member_removed
// billing.plan_changed, billing.payment_failed
```

---

## 18. Frontend Architecture

### 18.1 Tech stack

kitsy.ai web app is built with Blu itself:

```
@kitsy/blu-shell (app framework)
├── @kitsy/blu-bus (state management via EventBus)
├── @kitsy/blu-route (navigation)
├── @kitsy/blu-style (theming — Kitsy brand tokens)
├── @kitsy/blu-ui (component library)
├── @kitsy/blu-blocks (widgets)
├── @kitsy/blu-data (API data sources)
└── @kitsy/studio (embedded for /site/:id/studio route)
```

### 18.2 Build

```
Vite + React
├── Entry: kitsy.ai → main app shell
├── Code splitting:
│   ├── /dashboard         → lazy loaded
│   ├── /site/:id/studio   → lazy loaded (heaviest — includes full Studio)
│   ├── /marketplace       → lazy loaded
│   └── /settings          → lazy loaded
└── Output: static HTML + JS → deployed to Cloudflare Pages
```

### 18.3 API communication

```typescript
// Platform API calls use @kitsy/blu-data with REST adapter
const dataSources: DataSource[] = [
  { id: "sites", type: "rest", config: { url: "/api/v1/sites", headers: { Authorization: "Bearer {token}" } } },
  { id: "analytics", type: "rest", config: { url: "/api/v1/sites/{siteId}/analytics" } },
  { id: "billing", type: "rest", config: { url: "/api/v1/billing" } },
];
```

---

## 19. Infrastructure & Deployment

### 19.1 Infrastructure map

```
┌─────────────────────────────────────────────────┐
│  Cloudflare                                      │
│  ├── DNS (kitsy.ai, *.kitsy.ai, custom domains) │
│  ├── CDN (published sites, static assets)        │
│  ├── Pages (kitsy.ai web app)                    │
│  ├── R2 (asset storage, deployment bundles)       │
│  └── Workers (edge functions, image optimization)│
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Fly.io (or equivalent)                          │
│  ├── Kitsy Server (Node.js, WebSocket, auto-    │
│  │   scale, scale-to-zero for Pro)               │
│  └── Background Workers (publish pipeline,       │
│      image processing, analytics aggregation)    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Supabase                                        │
│  ├── PostgreSQL (all data)                       │
│  ├── Auth (user authentication)                  │
│  └── Realtime (future: live analytics)           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Upstash                                         │
│  └── Redis (session store, cache, pub/sub)       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  External Services                               │
│  ├── Stripe (billing)                            │
│  ├── Resend (transactional email)                │
│  └── Namecheap (domain registration — future)    │
└─────────────────────────────────────────────────┘
```

### 19.2 Cost estimates (early stage)

| Service | Starter (100 users) | Growth (1,000 users) | Scale (10,000 users) |
|---------|--------------------|--------------------|---------------------|
| Cloudflare (Pages + R2 + CDN) | Free tier | ~$20/mo | ~$100/mo |
| Fly.io (Server) | ~$5/mo (scale to zero) | ~$50/mo | ~$300/mo |
| Supabase (DB + Auth) | Free tier | $25/mo (Pro) | $100/mo |
| Upstash (Redis) | Free tier | ~$10/mo | ~$50/mo |
| Stripe | 2.9% + $0.30/txn | Same | Same |
| Resend | Free (3K emails/mo) | $20/mo | $100/mo |
| AI (Anthropic/OpenAI) | ~$10/mo | ~$100/mo | ~$1000/mo |
| **Total** | **~$15/mo** | **~$225/mo** | **~$1650/mo** |

Break-even at ~12 Pro users ($228/mo revenue vs $225/mo cost at 1K user scale).

### 19.3 CI/CD

```
GitHub Actions:
  ├── On PR: lint, type-check, test, bundle size check
  ├── On merge to main:
  │   ├── Build kitsy.ai web app → deploy to Cloudflare Pages
  │   ├── Build @kitsy/server → deploy to Fly.io (staging)
  │   └── Publish @kitsy/blu-* packages → npm (if version bumped)
  └── On release tag:
      ├── Deploy to production
      └── Run smoke tests against production
```

---

## 20. Implementation Sequence

### 20.1 Sprint plan (2-week sprints)

| Sprint | Deliverables |
|--------|-------------|
| **S1** | Project scaffold: Vite + Blu app shell, Supabase setup, basic auth (signup/login/logout) |
| **S2** | Tenant creation: auto-create tenant on signup, JWT with tenant claims |
| **S3** | Dashboard: site list (empty state + cards), create site flow (blank only) |
| **S4** | Studio integration: embed Studio at `/site/:id/studio`, config load/save to Supabase |
| **S5** | Publish pipeline (static): SSR build → R2 upload → serve from *.kitsy.ai subdomain |
| **S6** | Site settings: name, subdomain, SEO meta, status management |
| **S7** | Template system: built-in templates (5 MVP), template browser, create-from-template flow |
| **S8** | AI create flow: onboarding integration with Mind, generate → preview → apply |
| **S9** | Asset management: upload, image optimization, asset browser in Studio |
| **S10** | Custom domains: add domain, DNS verification polling, SSL provisioning |
| **S11** | Billing: Stripe integration, plan selection, upgrade/downgrade, webhook handling |
| **S12** | Plan enforcement: limit checks on all gated actions, usage tracking |
| **S13** | Analytics: event collection script, analytics storage, dashboard UI |
| **S14** | Team management: invite flow, role assignment, per-site permissions |
| **S15** | Notifications: transactional emails (Resend), in-app notification center |
| **S16** | Onboarding wizard: first-time UX, guided tour, AI-assisted creation |
| **S17** | API layer: REST API for all platform operations, API key management |
| **S18** | Marketplace: template submission, review flow, public listing |
| **S19** | Settings: profile, connected accounts, data export, account deletion |
| **S20** | Polish: error handling, loading states, empty states, responsive dashboard, accessibility |

### 20.2 Dependencies

| Dependency | Required From | Required By Sprint |
|-----------|--------------|-------------------|
| Supabase project + auth | Infrastructure | S1 |
| `@kitsy/blu-shell` (rebrand) | Blu Phase 0 | S1 |
| `@kitsy/studio` (basic) | Studio S1-S7 | S4 |
| `@kitsy/server` (config store) | Server S1-S5 | S4 |
| Cloudflare R2 + Pages | Infrastructure | S5 |
| `@kitsy/mind` (basic) | Mind S1-S5 | S8 |
| Stripe account + products | External | S11 |
| Resend account | External | S15 |

### 20.3 Parallelization strategy

```
TRACK 1: Blu Framework (Phase 0-1)       ████████████
TRACK 2: Server                                 ████████████████
TRACK 3: Studio                                      █████████████████
TRACK 4: Mind                                              ██████████████
TRACK 5: kitsy.ai Platform                         █████████████████████████
                                          ─────────────────────────────────
                                          Month 1   Month 2   Month 3   Month 4   Month 5

Platform can start S1-S3 immediately (basic app shell + auth + dashboard).
S4+ depends on Studio and Server tracks delivering basic functionality.
```

The platform is the integration layer — it can scaffold its own UI early but needs the other tracks to deliver real functionality. The critical path is: Blu Phase 0 → Server basic → Studio basic → Platform S4 (Studio embed).
