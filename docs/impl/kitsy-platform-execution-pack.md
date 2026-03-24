# Kitsy Platform Shell — Execution Pack

**Track:** B (Platform Shell)  
**Phase:** 1 (Active NOW — minimal shell), Phase 2+ (expanded after Server ships)  
**Owner:** Prashant + Codex agents  
**Repo:** `github.com/kitsy-ai/kitsy` (platform monorepo)  
**Spec Documents:** Kitsy Platform Architecture, Blu Product Hosting Spec  
**Status:** Phase 1 scope is ONLY: auth, tenant, module-aware dashboard skeleton, basic site management. Full hosting, billing, analytics, marketplace — all Phase 2+.

---

## Scope Rule

> **This track builds the platform shell that all modules plug into. In Phase 1, it is a skeleton: auth, tenancy, module-aware navigation, and basic Blu site management (config CRUD).**
>
> Full publish pipeline, domains, billing, analytics, Studio embed, AI flows — all begin AFTER the Server track delivers (Phase 2+).

---

## 1. Sprint Plan

### Phase 1 Sprints (Active NOW — Weeks 1-8)

#### Sprint B1 — Project Scaffold (Weeks 1-2)

**Objective:** Scaffold the kitsy.ai web app and set up authentication.

**Ref:** Platform Architecture §6 (Identity), §10 (Dashboard Shell)

| # | Task |
|---|------|
| 1 | Create platform monorepo: `kitsy/` with `apps/web/`, `packages/platform/`, `packages/server/` (empty stub) |
| 2 | Set up pnpm workspace |
| 3 | Set up Vite + React in `apps/web/`, using `@kitsy/blu-shell` as the app framework |
| 4 | Set up Supabase project: enable email auth, magic link, Google OAuth |
| 5 | Implement auth pages: `/login` (email + password + magic link + Google), `/signup` |
| 6 | Implement session management via Supabase client |
| 7 | Implement protected routes (redirect unauthenticated to /login) |
| 8 | Implement logout |
| 9 | Create minimal layout: header (logo + user avatar/menu), empty content area |

**Exit criteria:**
- [ ] User can sign up with email or Google
- [ ] User can log in, see authenticated dashboard (empty)
- [ ] Magic link auth works
- [ ] Logout works, redirects to /login
- [ ] App uses `@kitsy/blu-shell` for rendering

**DO NOT:** Build tenant management, module system, or any Blu-specific UI.

---

#### Sprint B2 — Tenant & Module Model (Weeks 3-4)

**Objective:** Implement tenant creation and the module manifest system.

**Ref:** Platform Architecture §5 (Module Contract), §7 (Tenancy)

| # | Task |
|---|------|
| 1 | Create `tenants` table in Supabase with RLS (from Platform Architecture §7.1): id, name, slug, plan, active_modules, max_team_members, storage limits |
| 2 | Create `tenant_members` table: tenant_id, user_id, role, invited_at, accepted_at |
| 3 | Auto-create tenant on user signup: default name = "{name}'s Workspace", default plan = "starter", default active_modules = ["blu"] |
| 4 | Implement JWT custom claims via Supabase edge function: add tid, roles, modules, plan to JWT |
| 5 | Define `ModuleManifest` TypeScript interface (from Platform Architecture §5.1): id, name, routes, namespace, commands, entities, permissions |
| 6 | Create Blu module manifest: id="blu", name="Websites", icon="globe", routes=[{path: "/blu", label: "Websites"}] |
| 7 | Build manifest-driven sidebar navigation: reads registered manifests, only shows modules in tenant.active_modules |
| 8 | Store manifests in a registry (code-level, not database) |

**Exit criteria:**
- [ ] Tenant auto-created on signup
- [ ] JWT contains tid, modules: ["blu"], roles, plan
- [ ] Blu module manifest registered
- [ ] Dashboard sidebar shows "Websites" (Blu) entry
- [ ] Navigation is manifest-driven — no hardcoded module routes in the shell
- [ ] Navigating to `/blu` shows a placeholder "Blu module content area"

**DO NOT:** Build module activation UI, billing, or Coop manifest. Don't build cross-module events.

---

#### Sprint B3 — Blu Site Management (Weeks 5-6)

**Objective:** Basic site CRUD within the Blu module area.

**Ref:** Blu Product Hosting §6 (Dashboard), §7 (Site Management)

| # | Task |
|---|------|
| 1 | Create `sites` table in Supabase: id, tenant_id, name, subdomain (unique), status, created_at, updated_at (with RLS) |
| 2 | Create `configs` table: tenant_id, site_id, version, config (JSONB), updated_by, updated_at |
| 3 | Build Blu dashboard page at `/blu`: site card grid with create button |
| 4 | Empty state: "No sites yet. Create your first site." |
| 5 | Create site flow: name input → auto-generate subdomain → create site + blank config → redirect to site page |
| 6 | Site card: shows name, subdomain, status (draft), last edited |
| 7 | Click site card → `/blu/site/:id` → shows site detail page |
| 8 | Delete site: confirmation dialog → soft delete (status = "archived") |

**Exit criteria:**
- [ ] User can create a new site from dashboard
- [ ] Site appears in the site list with card UI
- [ ] Site has a blank ApplicationConfiguration stored in configs table
- [ ] User can click into a site detail page
- [ ] Sites are tenant-isolated (user A cannot see user B's sites)

**DO NOT:** Build Studio embed, publish pipeline, or config editing. That's B4 and Phase 2.

---

#### Sprint B4 — Config Editor Placeholder (Weeks 7-8)

**Objective:** Basic JSON config editor for sites — placeholder until Studio ships.

**Ref:** Blu SSOT §6.1 (ApplicationConfiguration)

| # | Task |
|---|------|
| 1 | Site detail page (`/blu/site/:id`): load config from `configs` table |
| 2 | JSON editor panel: display ApplicationConfiguration as formatted JSON with syntax highlighting |
| 3 | Edit and save: user can modify JSON, click Save, config persists with version increment |
| 4 | Validation on save: run `@kitsy/blu-validate` (if available) or basic JSON.parse check |
| 5 | Preview button: opens new tab with `?_render=<base64 of config>` using Blu CDN runtime |
| 6 | Version display: show current config version number |
| 7 | Create-from-template: dropdown to select from 3 hardcoded example configs (simple landing, business, contact page) from `@kitsy/blu-types` examples |

**Exit criteria:**
- [ ] User can view their site's config as JSON
- [ ] User can edit JSON and save (version increments)
- [ ] Invalid JSON shows error, doesn't save
- [ ] Preview opens a tab rendering the config via Blu URL rendering
- [ ] Create-from-template populates config with a starting template
- [ ] Config saves are tenant-isolated

**DO NOT:** Build visual editor (Studio), publish pipeline, domain management, or billing. This is a placeholder editing experience.

---

### Phase 2 Sprints (After Server Track ships — Weeks 9-16)

**Start condition:** Server sprints C1-C5 complete. Config store and sync protocol operational.

#### Sprint B5 — Server Integration (Weeks 9-10)

| # | Task |
|---|------|
| 1 | Replace Supabase-direct config storage with Kitsy Server config API |
| 2 | Connect platform to Server via `render(config, { platform: "kitsy" })` for real-time sync |
| 3 | Config editing now goes through Server sync protocol (propose/accept/reject) |
| 4 | Display sync status: "Saved ✓" / "Saving..." / "Offline" |

#### Sprint B6 — Publish & Site Settings (Weeks 11-12)

| # | Task |
|---|------|
| 1 | Publish button → calls Server publish pipeline (SSR → R2 → CDN) |
| 2 | Show deployment status: pending → building → deployed / failed |
| 3 | Deployment history page |
| 4 | Site settings page: name, subdomain, SEO meta (title, description, OG image) |
| 5 | Status management: draft → published → archived |

#### Sprint B7 — Templates & Billing (Weeks 13-14)

| # | Task |
|---|------|
| 1 | Template browser: 5 built-in templates with thumbnails and preview |
| 2 | Create-from-template flow: browse → preview → name → create site |
| 3 | Stripe integration: create customer on signup, plan selection page |
| 4 | Upgrade/downgrade flow, webhook handling |
| 5 | Billing page: current plan, usage, invoice history |

#### Sprint B8 — Domains & Assets (Weeks 15-16)

| # | Task |
|---|------|
| 1 | Custom domain flow (Pro+): enter domain → show DNS instructions → poll verification → SSL provision |
| 2 | Asset upload: image upload with optimization, asset browser |
| 3 | Plan enforcement: limit checks on site creation, asset upload, AI requests |

---

### Phase 4+ Sprints (After Studio + Mind ship)

These sprints are specified but NOT ACTIVE. Do not begin until Phase 4 gate is met.

| Sprint | Deliverables |
|--------|-------------|
| B-S4b | Studio embed at `/blu/site/:id/studio` (replaces JSON editor) |
| B-AI | AI create flow: onboarding → Mind generate → preview → apply |
| B-TEAM | Team management: invite, roles, per-site permissions |
| B-ANALYTICS | Analytics collection, storage, dashboard |
| B-ONBOARD | Onboarding wizard with guided tour |
| B-API | REST API for all operations, API key management |
| B-MARKET | Template marketplace: submission, review, listing |
| B-NOTIFY | Transactional emails (Resend), in-app notifications |

---

## 2. Phase Gates

**Phase 1 Gate (Platform Shell):**
- [ ] Auth works (signup, login, logout, magic link, Google)
- [ ] Tenant auto-created with module manifest system
- [ ] Dashboard navigation is manifest-driven
- [ ] Blu site CRUD works (create, list, view config, delete)
- [ ] JSON config editor with preview via URL rendering
- [ ] All data tenant-isolated via RLS

**Phase 2 Gate (Blu Hosting):**
- [ ] Config sync via Kitsy Server (not direct Supabase)
- [ ] Publish pipeline: SSR → CDN → live site
- [ ] Site settings, deployment history
- [ ] Templates, billing, domains functional

---

## 3. Track Governance

### Code rules

```
Platform shell:
  - Built with @kitsy/blu-shell (eating our own cooking)
  - Module loading is lazy (React.lazy + dynamic import)
  - NO module-specific code in the shell (shell reads manifests only)
  - Auth state managed via Blu bus commands
  - Navigation is manifest-driven (no hardcoded routes per module)
  - All database tables include tenant_id with RLS
  - Supabase client for direct DB access in Phase 1; Server API in Phase 2+
```

### Dependency rules

```
ALLOWED:
  apps/web → @kitsy/blu-shell, @kitsy/blu-ui, @kitsy/blu-bus, supabase-js
  packages/platform → @kitsy/blu-types

NOT ALLOWED:
  apps/web → @kitsy/studio (until Phase 4)
  apps/web → @kitsy/mind (until Phase 4)
  packages/platform → @kitsy/server (shell ↔ server communicate via API/WebSocket, not import)
```

### Sprint handoff template

```markdown
## Sprint B{N} Complete

### What shipped
- Routes added: [list]
- Tables created: [list]
- Key components: [list]

### Exit criteria
- [ ] Criterion: [evidence]

### Auth/tenant state
- Supabase project: [URL]
- JWT custom claims: [working/not yet]
- Module manifests registered: [list]

### What next sprint needs
- [Any API contracts, table schemas, auth changes]
```
