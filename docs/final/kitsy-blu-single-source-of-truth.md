# Kitsy Blu — Single Source of Truth

**Version:** 2.0  
**Date:** 2026-03-22  
**Status:** Canonical reference — all prior drafts are superseded by this document  
**Owner:** HEYPKV Innovations Private Limited  
**Product Brand:** Kitsy (kitsy.ai)  
**Framework Brand:** Blu (placeholder, pending trademark clearance)  
**Audience:** Founder, architects, investors, implementation teams, Codex agents

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision, Thesis & Differentiation](#2-vision-thesis--differentiation)
3. [Brand Hierarchy & Product Boundaries](#3-brand-hierarchy--product-boundaries)
4. [Distribution Model (Four Tiers)](#4-distribution-model-four-tiers)
5. [Architecture Overview](#5-architecture-overview)
6. [Core Contracts & Schemas](#6-core-contracts--schemas)
7. [Package Map & Ownership](#7-package-map--ownership)
8. [Phased Roadmap](#8-phased-roadmap)
9. [Security Model](#9-security-model)
10. [Performance Architecture](#10-performance-architecture)
11. [Observability & Debugging](#11-observability--debugging)
12. [Plugin Architecture](#12-plugin-architecture)
13. [Schema Versioning & Migration](#13-schema-versioning--migration)
14. [Testing Strategy](#14-testing-strategy)
15. [Open Source & Licensing Strategy](#15-open-source--licensing-strategy)
16. [Revenue Model](#16-revenue-model)
17. [Competitive Landscape](#17-competitive-landscape)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Key Architectural Decisions (ADR Log)](#19-key-architectural-decisions-adr-log)
20. [Appendix: SOLID & Principles Checklist](#20-appendix-solid--principles-checklist)

---

## 1. Executive Summary

Kitsy is building an AI-native business product suite under the kitsy.ai brand, operated by HEYPKV Innovations Private Limited. One foundational piece of that suite is **Blu** — a schema-driven, event-aware, transport-capable UI framework and runtime.

Blu is not a website builder. It is a **portable UI execution model** in which:

- UI is represented as structured data (ViewNode trees) rather than tightly-bound code
- State transitions are modeled through serializable actions, reducers, and effects
- Data dependencies are declared through typed bindings, not ad-hoc fetch calls
- Browser, server, AI agents, and other endpoints participate in the same interaction model via an EventBus transport layer
- A visual builder, AI generator, and hosted platform all operate against the same underlying contract

The core thesis — **UI as data, state as data, transitions as data** — is designed for the AI era. LLMs are fundamentally better at generating, validating, and patching structured data than arbitrary code. A framework built around serializable contracts gives AI a typed, bounded surface to operate on.

Blu already exists as a working proof of concept (`@pkvsinha/react-app`, 11 packages, v0.0.12) with four live distribution modes: CDN script tag, npm packages, kitsy.ai platform, and URL-encoded rendering via query parameters. This document defines the complete architecture, contracts, and roadmap to take it from POC to product.

---

## 2. Vision, Thesis & Differentiation

### 2.1 Why this framework exists

Modern UI stacks bind together too many concerns — HTML structure, rendering logic, state management, navigation, backend coupling, cross-client communication, and design system implementation. This creates friction for developers who want reusable primitives, teams who want visual composition, businesses who want fast digital presence, and AI systems that need strict contracts to operate safely.

Blu was conceived to decouple these concerns through five foundational ideas:

**A. UI should be abstracted into data.** Instead of binding application structure to JSX/HTML, the UI is representable as a structured schema (ViewNode tree). A renderer interprets that schema and produces runtime output. The same product intent can be developer-authored, visually assembled, AI-generated, server-managed, or rendered across multiple surfaces.

**B. State should be an explicit action-driven system.** State is not trapped inside a browser component tree. Transitions are triggered through typed actions, command semantics, middleware chains, and effect pipelines. This is philosophically inspired by Redux, but extended beyond purely client-side state.

**C. Data dependencies should be declared, not implemented.** Components declare what data they need through bindings to named data sources. The runtime resolves those declarations through pluggable adapters (REST, GraphQL, bus-mediated, static). AI can wire data connections through references, not fetch() calls.

**D. The integration/bus layer is first-class, not bolt-on.** Communication between browser and server, between tabs, between runtime and AI agents — all operate on the same EventBus protocol. A server can direct a browser to navigate, update state, or react to an event. The UI runtime is transport-aware.

**E. Transitions are data, not code.** User interactions (clicks, form submissions, navigation) are wired through serializable Action declarations. The entire application behavior — what happens when the user does X — is a data structure, not imperative code. This makes the application inspectable, diffable, and AI-generatable end-to-end.

### 2.2 Core differentiation statement

**Blu is a schema-driven UI runtime in which UI, state transitions, data dependencies, events, and multi-endpoint communication operate on a shared contract, making it suitable for visual tools, AI generation, server-managed state, and business-grade workflows.**

### 2.3 The specific differentiators

**A. UI as data, not just code.** The system uses a serializable ViewNode tree and component registry model. Visual editors, AI agents, persistence systems, and deployment tooling reason about data contracts more reliably than arbitrary component code.

**B. The integrate/bus layer is the most important uniqueness.** The EventBus enables communication between browser and server, browser tabs, runtime and AI agents, runtime and background services, user-facing and operational surfaces. Most competitors do not make this event fabric the center of the product story.

**C. Server-managed state and browser replica model.** In premium scenarios, the browser acts as a replica of server authority. This enables collaborative experiences, operator-assisted workflows, synchronized sessions, and business supervision.

**D. Shared contract for all authoring modes.** The same structured contract supports hand-authored development, low-code composition, AI generation, AI patching, and runtime orchestration. AI participates in a constrained system, not a thin wrapper over code generation.

**E. Four-tier distribution from zero-install to managed platform.** The same `render(config)` contract works as a CDN script tag, an npm package, a URL-encoded payload, or a kitsy.ai managed deployment. No other framework offers this range from a single API.

### 2.4 What Blu is NOT

The primary uniqueness should not be framed as: just another site builder, just another design system, just another component library, just another AI code generator. The correct framing is:

- **Framework first:** a transport-aware, schema-driven UI engine
- **Builder second:** a low-code/no-code composition surface on that engine
- **Platform third:** hosted business tooling built on top of the same runtime

### 2.5 The AI-readiness thesis

> **An AI that generates structured data against a validated schema will always be more reliable than an AI that generates arbitrary code.**

| Decision | AI Benefit |
|----------|-----------|
| ViewNode (UI as data) | AI generates JSON, not JSX. JSON is validatable, diffable, patchable. |
| ComponentRegistry (URN catalog) | AI chooses from a known set with typed prop schemas. Cannot hallucinate a component that doesn't exist. |
| Actions (transitions as data) | AI wires behavior through typed declarations, not arbitrary event handlers. |
| DataSource + bindings | AI connects components to data through references, not fetch() calls. |
| Form contract | AI generates forms as field declarations with validation rules, not onChange handlers. |
| EventBus | AI agents participate via the same bus protocol. No special integration. |
| JSON Schema validation | Every AI-generated config passes deterministic validation before reaching the user. |
| JSON Patch (RFC 6902) | AI edits are patches, not regenerations. Change one section without touching the rest. |
| Migration chain | AI generates configs targeting the latest schema. Old configs auto-migrate. |

---

## 3. Brand Hierarchy & Product Boundaries

### 3.1 Brand structure

```
  HEYPKV Innovations Pvt. Ltd. (legal entity)
  │
  └── Kitsy (kitsy.ai) — product brand, platform, company identity
      │
      ├── Blu — open-source UI framework (this document)
      │   ├── @kitsy/blu-bus        (EventBus, Effects, Channels)
      │   ├── @kitsy/blu-shell      (Application orchestration, render)
      │   ├── @kitsy/blu-core       (Base primitives)
      │   ├── @kitsy/blu-ui         (Component library)
      │   ├── @kitsy/blu-route      (Navigation)
      │   ├── @kitsy/blu-style      (Theme, tokens, CSS builder)
      │   ├── @kitsy/blu-context    (Hooks, AppContext)
      │   ├── @kitsy/blu-grid       (Layout)
      │   ├── @kitsy/blu-icons      (Icon set)
      │   ├── @kitsy/blu-blocks     (Widgets, Forms)
      │   ├── @kitsy/blu-templates  (Pre-built templates)
      │   ├── @kitsy/blu-data       (Data sources, adapters, bindings)
      │   ├── @kitsy/blu-wire       (Transport adapters)
      │   ├── @kitsy/blu-sync       (Client-side sync protocol)
      │   ├── @kitsy/blu-types      (TypeScript types + JSON Schema)
      │   ├── @kitsy/blu-validate   (Config validation, AI guardrails)
      │   ├── @kitsy/blu-test       (Testing utilities)
      │   ├── @kitsy/blu-devtools   (Bus inspector, state viewer)
      │   ├── @kitsy/blu-cli        (Dev tooling CLI)
      │   └── @kitsy/create-blu     (Project scaffolder)
      │
      ├── Kitsy Studio  — no-code builder (proprietary)
      ├── Kitsy Mind    — AI agent framework (proprietary)
      ├── Kitsy Server  — server runtime (BSL)
      └── kitsy.ai      — hosted platform (SaaS)
```

**Key distinction:** Blu is ONE product under Kitsy — the open-source UI framework that powers everything. A developer can use Blu without ever touching kitsy.ai. A business user can use kitsy.ai without ever knowing Blu exists.

**Single npm scope:** Everything lives under `@kitsy`. The `blu-` prefix separates open-source framework packages from proprietary platform packages. One npm org, one billing, clean separation.

**Brand usage:** Kitsy is the product brand. HEYPKV Innovations is the legal entity. Don't mention HEYPKV in developer-facing materials. This is standard practice (Alphabet/Google, Meta/Facebook).

### 3.2 Product boundaries

**What belongs in the open framework (Blu):**

- Schema and renderer contracts
- Action/event/bus runtime
- Data source abstraction and built-in adapters
- Component registry model
- Theme, layout, and styling system
- Shell and composition primitives
- Transport abstractions usable in any app
- Sync helpers not tightly bound to Kitsy SaaS
- Validation utilities (standalone, for AI pipelines)
- Developer tooling and testing utilities

**What belongs in Kitsy proprietary layers:**

- Hosted visual builder (Studio)
- AI business workflows and managed agent features (Mind)
- Tenant-aware deployment and publishing system
- SaaS platform: accounts, plans, hosting, domain operations
- Server authority and multi-tenant business runtime
- Prompt templates, training data, agent logic

**Why this split matters:** It creates external developer adoption, reduces lock-in perception, retains monetizable platform layers, and preserves architectural clarity between engine and product.

### 3.3 Domain and web presence

| Asset | Purpose |
|-------|---------|
| `kitsy.ai` | Main platform — builder, hosting, dashboard, business tools |
| `blu.kitsy.ai` | Framework docs, API reference, getting started guides |
| `npmjs.com/org/kitsy` | All packages (framework + platform) |
| `github.com/kitsy-ai` | GitHub organization for all repos |
| `github.com/kitsy-ai/blu` | Open-source framework monorepo |

### 3.4 Taglines

- **Blu** — "UI as data. Render anything."
- **Kitsy Studio** — "Design without code."
- **Kitsy Mind** — "AI that builds with you."
- **kitsy.ai** — "Your business, online, in minutes."

---

## 4. Distribution Model (Four Tiers)

Blu's most powerful architectural advantage is that the same `render(config)` contract works across four distinct distribution modes, from zero-install to fully managed. This is the foundation of the free-to-premium funnel.

### 4.1 Tier overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      DISTRIBUTION MODEL                              │
│                                                                      │
│  TIER 1: CDN / UMD (Free, zero-install)                             │
│  ─────────────────────────────────────                               │
│  • Single <script> tag from jsDelivr/unpkg or cdn.kitsy.ai          │
│  • render(config) — config IS the app                                │
│  • No build tooling required                                         │
│  • Self-hosted, user controls infrastructure                         │
│  • Blu bundles React + ReactDOM internally                           │
│  • Target: solo devs, small businesses, quick prototypes             │
│                                                                      │
│  TIER 2: URL-Encoded Rendering (Free, zero-hosting)                  │
│  ──────────────────────────────────────────────────                  │
│  • Entire app encoded as base64 in query parameter                   │
│  • ?_render=<base64>&_root=appId&_strict=1                           │
│  • Zero hosting required — app IS the URL                            │
│  • Shareable, QR-codeable, embeddable                                │
│  • Target: compliance pages, legal disclosures, prototypes,          │
│    email-embedded UIs, AI-generated shareable links                   │
│                                                                      │
│  TIER 3: npm / ESM (Free, developer-grade)                           │
│  ──────────────────────────────────────────                          │
│  • npm install @kitsy/blu-shell (or individual packages)             │
│  • Tree-shakeable, build-tool integrated                             │
│  • Full TypeScript support, autocomplete, refactoring                │
│  • Individual packages consumable standalone                         │
│  • Target: professional developers, app teams                        │
│                                                                      │
│  TIER 4: kitsy.ai Platform (Premium)                                 │
│  ────────────────────────────────────                                │
│  • Same render(config) contract                                      │
│  • + Kitsy Server (state sync, auth, config persistence)             │
│  • + Kitsy Studio (visual builder)                                   │
│  • + Kitsy Mind (AI generation, patching, agents)                    │
│  • + Platform services (domains, CDN, analytics, CRM)                │
│  • + Dashboard, billing, multi-tenant isolation                      │
│  • Target: businesses wanting managed experience                     │
│                                                                      │
│  ═══════════════════════════════════════════════                     │
│  PRINCIPLE: The ApplicationConfiguration contract is IDENTICAL       │
│  across all four tiers. A Tier 1 config works on Tier 4.            │
│  A Tier 4 config works on Tier 1 (minus server features).           │
│  The upgrade path is seamless. The downgrade path is safe.           │
│  ═══════════════════════════════════════════════════════════         │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tier 1: CDN / UMD

```html
<script src="https://cdn.jsdelivr.net/npm/@kitsy/blu-shell@latest/dist/umd/blu.standalone.min.js"></script>
<script>
  const { render } = window.Blu;
  render({
    brand: "My Business",
    views: [
      { id: "home", view: "Welcome to My Business" },
      { id: "about", view: "About us" }
    ],
    navigation: ["home", "about"]
  });
</script>
```

**UMD bundle composition:**

```
@kitsy/blu-shell.standalone.min.js
├── react (pinned version, not externalized)
├── react-dom
├── @kitsy/blu-bus     (EventBus, Effects, Channels)
├── @kitsy/blu-core    (primitives)
├── @kitsy/blu-ui      (component library)
├── @kitsy/blu-route   (navigation)
├── @kitsy/blu-style   (theme, tokens, CSS builder)
├── @kitsy/blu-context (hooks, AppContext)
├── @kitsy/blu-grid    (layout)
├── @kitsy/blu-data    (data source registry, built-in adapters)
├── @kitsy/blu-icons   (icon subset, tree-shaken for UMD)
├── @kitsy/blu-blocks  (widgets, forms)
└── Exposes: window.Blu = { render, React, ReactDOM, EventBus, ... }
```

**Design rules:**

- **Single global namespace:** `window.Blu` (migrated from `window.ReactApp`)
- **Version-locked React:** UMD pins its own React. Users don't install React separately.
- **Size budget:** < 150KB gzipped (core). Lazy-load `blu-blocks`, `blu-icons`, `blu-templates`.
- **CDN strategy:** Publish to npm (auto-CDN via jsDelivr/unpkg). Optional Kitsy-managed CDN (`cdn.kitsy.ai/blu@version/blu.min.js`) for premium SLA.
- **Premium bridge:** Bundle detects `window.__KITSY_PLATFORM__` and auto-attaches transport if page is served from kitsy.ai.

### 4.3 Tier 2: URL-Encoded Rendering

The entire application can be encoded as a base64 payload in a URL query parameter. The host page loads the Blu runtime and auto-renders from the URL.

```
https://blu.kitsy.ai/run?_render=eyJicmFuZCI6Ik15IEJ1...&_root=app&_strict=1
```

**Protocol:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `_render` | Yes | Base64-encoded (standard or URL-safe) UTF-8 JSON of ApplicationConfiguration |
| `_root` | No | DOM element ID to mount into (default: `"app"`) |
| `_strict` | No | `"1"` enables strict JSON Schema validation before render |

**Implementation (existing, to be formalized):**

```typescript
(function autoRenderFromQuery(global: any) {
  if (typeof window === "undefined") return;

  const run = () => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("_render");
    if (!encoded) return;

    const rootId = params.get("_root") || "app";
    const strict = params.get("_strict") === "1";

    // Decode base64url (supports both standard and URL-safe variants)
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder("utf-8").decode(bytes);

    const appConfig = JSON.parse(json);

    if (strict) {
      const validation = validate(appConfig);
      if (!validation.valid) {
        console.error("[Blu] Config validation failed:", validation.errors);
        return;
      }
    }

    render(appConfig, { rootId });
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    setTimeout(run, 0);
  }
})(typeof window !== "undefined" ? window : {});
```

**Use cases for URL rendering:**

| Use Case | Description |
|----------|-------------|
| Compliance pages | Legal disclosures, cookie consent, privacy notices — rendered from a stable URL without dedicated hosting |
| Email-embedded UIs | Link in an email renders a complete mini-app (confirmation page, survey, receipt) |
| AI-generated shareable links | Kitsy Mind generates a config and returns a URL — recipient sees the app instantly |
| QR code experiences | QR code → URL → rendered app. Event badges, product info cards, menus. |
| Prototyping | Share a Blu app by sharing a link. No deployment, no hosting, no build step. |
| Embedded widgets | iframe src with `?_render=` parameter. Widget config is entirely in the URL. |
| Single-use pages | One-time-use pages (event RSVPs, temporary notices) that require zero infrastructure |

**Security rules for URL rendering:**

1. Configs from URL are treated as **untrusted input** — always validated against JSON Schema before render
2. No `eval()` or `new Function()` in the decode/render path
3. All string values in URL-loaded configs are sanitized against XSS before DOM insertion
4. URL-loaded configs cannot contain auth tokens (`$auth` field is stripped)
5. `_strict=1` is recommended for production use and required for kitsy.ai hosted runner
6. URL length limit: practical ~8KB of config (after base64 encoding). For larger configs, use a config hash that resolves via fetch to a stored config (future: `?_config=hash`)

**Compression strategy for URL rendering:**

For configs approaching the URL length limit, support optional compression:

| Parameter | Encoding |
|-----------|----------|
| `_render` | Base64 JSON (default) |
| `_renderz` | Base64 of deflate-compressed JSON (future) |

### 4.4 Tier 3: npm / ESM

```typescript
import { render } from "@kitsy/blu-shell";
import type { ApplicationConfiguration } from "@kitsy/blu-types";

const config: ApplicationConfiguration = {
  brand: "My Business",
  views: [
    { id: "home", children: [{ componentUrn: "urn:blu:widget:hero", props: { title: "Welcome" } }] }
  ]
};

render(config);
```

Individual packages are independently consumable:

```typescript
// Use only the bus
import { EventBus, Effects, Channels } from "@kitsy/blu-bus";

// Use only the theme
import { CssBuilder } from "@kitsy/blu-style";

// Use only data utilities
import { createDataRegistry, RestAdapter } from "@kitsy/blu-data";
```

### 4.5 Tier 4: kitsy.ai Platform (Premium)

```typescript
render(config, {
  platform: "kitsy",
  endpoint: "wss://rt.kitsy.ai",
  token: "<jwt>"
});
```

When platform options are provided:

1. `WebSocketTransport` auto-attaches to the EventBus
2. Config syncs from Kitsy Server (versioned, JSON Patch deltas)
3. State synchronization activates (server-authoritative mode)
4. Auth middleware validates JWT on every server-bound command
5. AI agents become reachable as bus participants
6. Kitsy dashboard can manage the site remotely

### 4.6 The render() API (Canonical)

```typescript
interface RenderOptions {
  // Platform
  platform?: "standalone" | "kitsy";
  endpoint?: string;                    // WebSocket URL for Kitsy Server
  token?: string;                       // JWT for authentication

  // Rendering
  rootId?: string;                      // DOM element ID (default: "app")
  mode?: "browser" | "ssr";            // Rendering mode

  // Transport
  transport?: Transport;                // Custom transport override
  transports?: Transport[];             // Multiple transports (e.g., WS + BroadcastChannel)

  // Validation
  strictValidation?: boolean;           // Validate config against schema before render

  // Lifecycle
  onReady?: (ctx: AppContext) => void;
  onError?: (error: BluError) => void;
}

function render(
  config: ApplicationConfiguration,
  options?: RenderOptions
): AppInstance;

function renderToStringSSR(
  config: ApplicationConfiguration
): Promise<string>;

interface AppInstance {
  bus: EventBus;
  state: StateManager;
  config: CompiledConfig;
  destroy(): void;
}
```

---

## 5. Architecture Overview

### 5.1 System architecture (complete)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         kitsy.ai (Platform)                          │
│                                                                      │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│   │  Studio   │  │   Mind   │  │ Platform │  │    Dashboard       │ │
│   │ (builder) │  │   (AI)   │  │ Services │  │ (billing, domains, │ │
│   └─────┬─────┘  └─────┬────┘  └─────┬────┘  │  analytics, CRM)  │ │
│         │              │              │        └────────┬──────────┘ │
│   ┌─────v──────────────v──────────────v────────────────v──────────┐ │
│   │                    Kitsy Server                                │ │
│   │     (session, config, state, auth, tenant isolation)           │ │
│   └───────────────────────┬────────────────────────────────────────┘ │
│                           │                                          │
└───────────────────────────┼──────────────────────────────────────────┘
                            │
     ═══════════ BLU BUS (transport: @kitsy/blu-wire) ═════════════
                            │
┌───────────────────────────┼──────────────────────────────────────────┐
│                           │              Blu (Framework)              │
│                           │                                          │
│   ┌───────────────────────v─────────────────────────────────────┐   │
│   │  @kitsy/blu-bus — EventBus, Effects, Channels, Commands     │   │
│   │  (the universal communication backbone — zero DOM deps)     │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│   │  blu-shell   │  │  blu-data     │  │  blu-validate            │  │
│   │  (core/      │  │  (sources,    │  │  (schema validation,     │  │
│   │   react/)    │  │   adapters,   │  │   AI guardrails)         │  │
│   │              │  │   bindings)   │  │                          │  │
│   └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                      │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│   │ blu-ui   │ │blu-blocks│ │ blu-style│ │blu-route │              │
│   │ blu-core │ │(+forms)  │ │ blu-grid │ │blu-contxt│              │
│   │ blu-icons│ │blu-tmplts│ │ blu-types│ │blu-sync  │              │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  blu-devtools — Bus inspector, State viewer, Config explorer │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│   DISTRIBUTION:                                                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐│
│   │ CDN / UMD    │ │ URL Encoded  │ │ npm / ESM    │ │ kitsy.ai  ││
│   │ (script tag) │ │ (?_render=)  │ │ (build tool) │ │ (managed) ││
│   │ FREE         │ │ FREE         │ │ FREE         │ │ PREMIUM   ││
│   └──────────────┘ └──────────────┘ └──────────────┘ └───────────┘│
│                                                                      │
│   render(config)   render(config)    render(config)   render(config, │
│                    from URL                           { platform:    │
│                                                        "kitsy" })   │
│                                                                      │
│   SAME CONTRACT. SAME API. SEAMLESS UPGRADE.                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Architecture layers

| Layer | Responsibility | Packages |
|-------|---------------|----------|
| **Shell / Orchestration** | Bootstrapping, config compilation, rendering, plugin mounting | `blu-shell` |
| **View Contract** | Serializable ViewNode tree, component URNs, registry-driven mapping | `blu-shell/core`, `blu-types` |
| **Data Layer** | Data source declaration, adapter registry, binding resolution, caching | `blu-data` |
| **State / Action Layer** | Command dispatch, reducers, middleware, effects, action resolution | `blu-bus`, `blu-context` |
| **Integrate / Bus** | Local event routing, cross-tab sync, client-server communication, AI participation | `blu-bus`, `blu-wire`, `blu-sync` |
| **Theme / Styling** | Design tokens, CSS layer generation, ITCSS cascade, plugin theming | `blu-style` |
| **Rendering Primitives** | Components, layout, icons, widgets, forms, blocks, templates | `blu-core`, `blu-ui`, `blu-grid`, `blu-icons`, `blu-blocks`, `blu-templates` |
| **Navigation** | Route management, adapter pattern (browser, memory, custom) | `blu-route` |
| **Validation** | JSON Schema validation, AI guardrail pipeline, config linting | `blu-validate` |
| **DevTools** | Bus inspector, state viewer, config explorer, performance profiler | `blu-devtools` |
| **Testing** | Config validation, headless rendering, bus simulation, snapshot testing | `blu-test` |

### 5.3 Current state (v0.0.12)

**What exists today:**

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

**Core primitives already built:**

- **EventBus** — Command-based `{type, target, payload, meta}`, middleware chain, 8 command types
- **Effects** — Saga-like: `onEvery`, `onLatest`, `onDebounce`, `onThrottle` with AbortSignal
- **Channels** — publish/subscribe + ask/answer RPC with correlation IDs
- **RequestCache** — TTL + inflight dedup
- **ComponentRegistry** — URN-keyed component map
- **NavigationStore** — Adapter pattern: `attachBrowserAdapter()`, `attachMemoryAdapter()`
- **ApplicationConfiguration** — Universal schema: views, config, dataSources, actions, permissions, registry, i18n, plugins, globalState, ext
- **Theme CssBuilder** — ITCSS 7-layer cascade with design tokens and plugin system
- **SSR support** — `render()` for browser, `renderToStringSSR()` for server
- **UMD standalone bundle** — Single script tag with auto-render from URL params
- **URL rendering** — `?_render=base64` query parameter auto-renders config

**Gaps to address (with phase assignments):**

| Gap | Severity | Phase |
|-----|----------|-------|
| EventBus is in-process only; no network transport | Critical | 1 |
| No command envelope metadata for routing ($source, $destination) | Critical | 1 |
| No data layer (data sources, adapters, bindings) | Critical | 1 |
| No serializable action/transition system | Critical | 1 |
| No form contract | Critical | 1 |
| No auth/authorization middleware | Critical | 2 |
| `View.view` accepts `React.ReactNode` (not serializable) | Critical | 0 (parallel ViewNode path) |
| No config versioning or persistence | Critical | 2 |
| React coupling not audited; universal/React boundary unclear | High | 0 |
| No developer tooling (CLI, DevTools) | High | 1 |
| No config validation utilities | High | 1 |
| No runtime token swap protocol for live theme preview | Medium | 3 |
| Singleton bus; no factory for isolated instances | Medium | 2 |
| `Command.type` is a fixed union; no extensibility | Medium | 1 |
| `window.ReactApp` needs migration to `window.Blu` | Medium | 0 |
| URL rendering lacks strict validation, compression | Medium | 0-1 |

---

## 6. Core Contracts & Schemas

This section defines the canonical data contracts for all major subsystems. These contracts are the single source of truth for implementation, AI generation, and visual builder tooling.

### 6.1 ApplicationConfiguration (Root Schema)

```typescript
interface ApplicationConfiguration {
  // ─── Schema Identity ───
  $schema?: string;                     // "https://blu.kitsy.ai/schema/v1.json"
  $version?: number;                    // Monotonic version counter (default: 1)

  // ─── App Identity ───
  brand?: string | BrandConfig;
  meta?: AppMeta;

  // ─── Views ───
  views: ViewDefinition[];
  home?: string;                        // Default view ID

  // ─── Navigation ───
  navigation?: NavigationConfig;

  // ─── Shell Configuration ───
  config?: ShellConfig;

  // ─── Data Sources ───
  dataSources?: DataSource[];

  // ─── Global State ───
  globalState?: Record<string, unknown>;

  // ─── Actions ───
  actions?: Record<string, Action>;     // Named reusable actions

  // ─── Permissions ───
  permissions?: PermissionConfig;

  // ─── Internationalization ───
  i18n?: I18nConfig;

  // ─── Component Registry ───
  registry?: Record<string, ComponentMeta>;

  // ─── Plugins ───
  plugins?: PluginConfig[];

  // ─── Extension Bag ───
  ext?: Record<string, unknown>;        // Escape hatch — governed, not a junk drawer
}
```

### 6.2 ViewNode (Serializable UI)

The `ViewNode` is the heart of the system. It represents a single UI element as pure data.

```typescript
interface ViewNode {
  // ─── Identity ───
  id: string;                           // Unique within the tree
  componentUrn: string;                 // "urn:blu:core:text", "urn:blu:widget:hero"

  // ─── Props ───
  props?: Record<string, unknown>;      // Serializable component props

  // ─── Children ───
  children?: ViewNode[];
  slot?: string;                        // Named slot in parent component

  // ─── Styling ───
  style?: Record<string, unknown>;
  className?: string;
  responsive?: Record<BreakpointKey, Partial<ViewNode>>;

  // ─── Data Binding ───
  data?: ViewNodeDataBinding;

  // ─── Repeater (Lists) ───
  repeat?: {
    source: string;                     // DataSource.id
    params?: Record<string, unknown>;   // Runtime params (filters, pagination)
    as: string;                         // Item variable name: "product", "post"
    key: string;                        // Path to unique ID in each item
    template: ViewNode;                 // Template rendered for each item
    pagination?: {
      type: "infinite-scroll" | "load-more" | "numbered";
      pageSize: number;
    };
  };

  // ─── Conditional Rendering ───
  when?: {
    source?: string;                    // DataSource.id or globalState key
    path?: string;                      // Dot-notation into the value
    operator: "exists" | "eq" | "neq" | "gt" | "lt" | "in" | "empty" | "notEmpty";
    value?: unknown;
  };

  // ─── Actions / Event Handlers ───
  actions?: {
    onClick?: Action;
    onSubmit?: Action;
    onLoad?: Action;                    // Fired when ViewNode mounts
    onVisible?: Action;                 // Fired when entering viewport
    onChange?: Action;
    onHover?: Action;
    [customEvent: string]: Action | undefined;
  };
}

type BreakpointKey = "sm" | "md" | "lg" | "xl" | "2xl";
```

### 6.3 ViewDefinition (Page/Screen)

```typescript
interface ViewDefinition {
  id: string;                           // Route key: "home", "products", "about"
  meta?: ViewMeta;                      // Page title, description, OG tags
  
  // CURRENT: React.ReactNode (backward compatible)
  view?: React.ReactNode | string;
  
  // NEW: Serializable ViewNode tree (parallel path)
  children?: ViewNode[];
  
  // Shell overrides for this view
  appBar?: { display?: boolean };
  layout?: string;                      // Layout template name
  
  // View-level data prefetch
  dataPrefetch?: string[];              // DataSource.ids to fetch before render
  
  // View-level permissions
  requireAuth?: boolean;
  requiredRoles?: string[];
}
```

**Migration note:** `view` (React.ReactNode) and `children` (ViewNode[]) are both supported. If `children` is present, it takes precedence. The `view` field exists for backward compatibility with existing POC configs. It will be deprecated once the ViewNode path is stable.

### 6.4 Data Source

```typescript
interface DataSource {
  id: string;                           // "products", "user-profile"
  type: string;                         // Adapter key: "rest", "graphql", "supabase", "static", "bus", "state"
  config: Record<string, unknown>;      // Adapter-specific configuration

  // Caching
  cache?: {
    ttl?: number;                       // Seconds. 0 = no cache.
    staleWhileRevalidate?: boolean;
    scope?: "global" | "view" | "session";
  };

  // Refresh / real-time
  refresh?: {
    interval?: number;                  // Poll interval in ms (0 = manual only)
    on?: string[];                      // Bus command types that trigger refresh
  };

  // Schema (for validation and AI generation)
  schema?: JSONSchema;
}

// ─── Data Source Adapter Interface (Strategy Pattern) ───

interface DataSourceAdapter<TConfig = unknown> {
  type: string;

  fetch(
    config: TConfig,
    params: Record<string, unknown>,
    context: DataContext
  ): Promise<DataResult>;

  mutate?(
    config: TConfig,
    action: string,                     // "create", "update", "delete", custom
    payload: unknown,
    context: DataContext
  ): Promise<MutationResult>;

  subscribe?(
    config: TConfig,
    handler: (data: DataResult) => void,
    context: DataContext
  ): Unsubscribe;
}

interface DataResult {
  data: unknown;
  meta?: {
    total?: number;
    cursor?: string;
    hasMore?: boolean;
    fetchedAt: number;
  };
  error?: { code: string; message: string };
}

interface MutationResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  optimisticRollback?: () => void;
}

interface DataContext {
  tenantId?: string;
  userId?: string;
  token?: string;
  locale?: string;
}
```

**Built-in adapters:**

| Adapter | Type Key | Config Shape | Use Case |
|---------|----------|-------------|----------|
| RestAdapter | `"rest"` | `{ url, method, headers }` | Standard REST APIs |
| GraphQLAdapter | `"graphql"` | `{ endpoint, query, variables }` | GraphQL endpoints |
| StaticAdapter | `"static"` | `{ data }` | Inline JSON data |
| BusAdapter | `"bus"` | `{ topic }` | Data via EventBus ask/answer |
| StateAdapter | `"state"` | `{ key }` | Read from globalState |
| SupabaseAdapter | `"supabase"` | `{ table, select, filter }` | Supabase client (lazy-loaded) |

### 6.5 ViewNode Data Binding

```typescript
interface ViewNodeDataBinding {
  source: string;                       // DataSource.id
  params?: Record<string, unknown>;

  // How source data maps to component props
  mapping?: {
    prop: string;                       // Target prop on the component
    path?: string;                      // JSONPath / dot-notation into result
    transform?: string;                 // Named transform from registry
  }[];

  // Loading state
  loading?: {
    component?: string;                 // URN of loading component
    props?: Record<string, unknown>;
  };

  // Error state
  error?: {
    component?: string;
    props?: Record<string, unknown>;
    retry?: boolean;
  };

  // Empty state
  empty?: {
    component?: string;
    props?: Record<string, unknown>;
  };
}
```

### 6.6 Actions (Serializable Transitions)

```typescript
type Action =
  | NavigateAction
  | BusAction
  | MutateAction
  | StateAction
  | FormAction
  | CompositeAction;

interface NavigateAction {
  type: "navigate";
  path: string;
  params?: Record<string, unknown>;
  replace?: boolean;
}

interface BusAction {
  type: "bus";
  command: string;                      // Command type on EventBus
  target?: string;
  payload?: Record<string, unknown>;
  meta?: Record<string, unknown>;       // Includes $destination for remote
}

interface MutateAction {
  type: "mutate";
  source: string;                       // DataSource.id
  action: string;                       // "create", "update", "delete", custom
  payload?: Record<string, unknown>;
  onSuccess?: Action;
  onError?: Action;
}

interface StateAction {
  type: "state";
  operation: "set" | "merge" | "toggle" | "increment" | "append" | "remove";
  key: string;                          // Dot-path into globalState
  value?: unknown;
}

interface FormAction_Semantic {
  type: "form";
  action: "reset" | "close";
}

interface CompositeAction {
  type: "sequence" | "parallel";
  actions: Action[];
}
```

**Action resolution at runtime:**

```typescript
function resolveAction(action: Action, context: AppContext): () => void | Promise<void> {
  switch (action.type) {
    case "navigate":
      return () => context.navigationStore.navigate(action.path, action.params);
    case "bus":
      return () => context.bus.dispatch({
        type: action.command, target: action.target,
        payload: action.payload, meta: action.meta
      });
    case "mutate":
      return async () => {
        const result = await context.dataRegistry.mutate(action.source, action.action, action.payload);
        if (result.success && action.onSuccess) resolveAction(action.onSuccess, context)();
        if (!result.success && action.onError) resolveAction(action.onError, context)();
      };
    case "state":
      return () => context.stateManager[action.operation](action.key, action.value);
    case "sequence":
      return async () => { for (const a of action.actions) await resolveAction(a, context)(); };
    case "parallel":
      return () => Promise.all(action.actions.map(a => resolveAction(a, context)()));
  }
}
```

### 6.7 Form Contract

```typescript
interface FormViewNode extends ViewNode {
  componentUrn: "urn:blu:form";

  form: {
    id: string;
    fields: FormField[];

    submit: {
      target: string;                   // DataSource.id or bus topic
      action: string;
      method?: "optimistic" | "pessimistic";
      transform?: string;
      onSuccess?: Action;
      onError?: Action;
    };

    validation?: {
      mode: "onBlur" | "onChange" | "onSubmit";
      debounce?: number;
    };

    layout?: "vertical" | "horizontal" | "grid";
    columns?: number;
  };
}

interface FormField {
  id: string;
  type: "text" | "email" | "password" | "number" | "date" | "select"
      | "multiselect" | "checkbox" | "radio" | "textarea" | "file"
      | "tel" | "url" | "color" | "range" | "toggle" | "rich-text";
  label: string;
  placeholder?: string;
  defaultValue?: unknown;

  rules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string;                    // Named validator from registry
    message?: string;
  };

  when?: ViewNode["when"];

  options?: FormFieldOption[] | {
    source: string;                     // DataSource.id for dynamic options
    labelPath: string;
    valuePath: string;
  };

  span?: number;                        // Column span in grid layout
  group?: string;                       // Fieldset grouping
}

interface FormFieldOption {
  label: string;
  value: unknown;
  disabled?: boolean;
}

// Form state commands on the EventBus
type FormCommand =
  | { type: "form:init"; target: string; payload: { fields: FormField[]; defaults: Record<string, unknown> } }
  | { type: "form:change"; target: string; payload: { field: string; value: unknown } }
  | { type: "form:validate"; target: string; payload: { field?: string } }
  | { type: "form:submit"; target: string }
  | { type: "form:reset"; target: string }
  | { type: "form:error"; target: string; payload: { field: string; message: string } }
  | { type: "form:success"; target: string; payload: { result: unknown } };
```

### 6.8 ComponentRegistry & ComponentMeta

```typescript
interface ComponentMeta {
  urn: string;                          // "urn:blu:widget:hero"
  displayName: string;                  // "Hero Banner"
  category: string;                     // "Marketing", "Form", "Layout"
  thumbnail?: string;
  defaultProps?: Record<string, unknown>;
  propSchema?: JSONSchema;              // Auto-generates property panels in Studio
  slots?: string[];                     // Named content slots
  tags?: string[];                      // For search/filter in builder
  version?: string;
}

// Registration (backward compatible — meta is optional)
componentRegistry.register(urn, ReactComponent, meta?);
```

### 6.9 EventBus Command Envelope

```typescript
interface Command {
  type: string;                         // Command type (extensible, not fixed union)
  target?: string;                      // Target identifier
  payload?: unknown;                    // Command data
  meta?: CommandMeta;                   // Metadata
}

interface CommandMeta {
  // ─── Routing ($ prefix = framework-managed, not user-set) ───
  $source?: string;                     // "browser:abc", "server", "ai:agent-1"
  $destination?: string | "*";          // Target endpoint or broadcast
  $correlationId?: string;              // Links request/response
  $timestamp?: number;                  // Epoch ms at origin
  $hop?: number;                        // Relay counter (prevents loops)
  $ttl?: number;                        // Max hops before discard
  $sessionId?: string;                  // Server session ID
  $auth?: string;                       // JWT (stripped before cross-browser forwarding)

  // ─── User-defined metadata ───
  [key: string]: unknown;               // Non-$ keys are user-space
}
```

**Routing rule:** If `$destination` is set and doesn't match local endpoint, forward to transport. If `$destination` is `"*"` or absent, deliver locally AND forward.

### 6.10 Transport Interface

```typescript
interface Transport {
  send(envelope: Envelope): Promise<void>;
  onReceive(handler: (envelope: Envelope) => void): Unsubscribe;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  state: "connecting" | "connected" | "disconnected" | "reconnecting";
  onStateChange(handler: (state: TransportState) => void): Unsubscribe;
}
```

**Implementations:**

| Transport | Direction | Use Case |
|-----------|-----------|----------|
| `LocalTransport` | in-process | Default (current behavior) |
| `WebSocketTransport` | bidirectional | Primary browser↔server |
| `SSETransport` | server→browser + HTTP POST | Firewall-friendly fallback |
| `BroadcastChannelTransport` | cross-tab | Multi-tab sync |
| `HTTPPollingTransport` | bidirectional polling | Last-resort fallback |

**Reconnection:** Exponential backoff (1s→2s→4s→8s→max 30s), heartbeat ping/pong every 30s, offline queue (max 1000 commands, FIFO eviction), dedup on replay via `$correlationId`.

---

## 7. Package Map & Ownership

### 7.1 Complete package inventory

**Open Source (Apache 2.0) — "Blu"**

| Package | Responsibility | Phase | New? |
|---------|---------------|-------|------|
| `@kitsy/blu-bus` | EventBus, Effects, Channels, Commands | 0 | Rebrand |
| `@kitsy/blu-shell` | App orchestration (core/ + react/ exports) | 0 | Rebrand + split |
| `@kitsy/blu-core` | Base primitives (Box, Text, Container) | 0 | Rebrand |
| `@kitsy/blu-ui` | Component library | 0 | Rebrand |
| `@kitsy/blu-route` | Navigation, adapter pattern | 0 | Rebrand |
| `@kitsy/blu-style` | Theme, tokens, CssBuilder | 0 | Rebrand |
| `@kitsy/blu-context` | React hooks, AppContext | 0 | Rebrand |
| `@kitsy/blu-grid` | Layout primitives | 0 | Rebrand |
| `@kitsy/blu-icons` | Icon set | 0 | Rebrand |
| `@kitsy/blu-blocks` | Widgets, Forms | 0 | Rebrand + forms |
| `@kitsy/blu-templates` | Pre-built templates | 0 | Rebrand |
| `@kitsy/blu-types` | TypeScript types + JSON Schema definitions | 0 | **New** |
| `@kitsy/blu-data` | Data sources, adapters, binding resolution | 1 | **New** |
| `@kitsy/blu-wire` | Transport interface + adapters | 1 | **New** |
| `@kitsy/blu-sync` | Client-side sync protocol | 2 | **New** |
| `@kitsy/blu-validate` | Config validation, AI guardrails | 1 | **New** |
| `@kitsy/blu-test` | Testing utilities | 1 | **New** |
| `@kitsy/blu-devtools` | Bus inspector, state viewer, config explorer | 1 | **New** |
| `@kitsy/blu-cli` | Dev tooling CLI | 1 | **New** |
| `@kitsy/create-blu` | Project scaffolder | 1 | **New** |

**Proprietary / BSL — "Kitsy Platform"**

| Package | Responsibility | Phase | License |
|---------|---------------|-------|---------|
| `@kitsy/server` | Kitsy Server (Node.js) | 2 | BSL |
| `@kitsy/protocol` | Shared wire types | 2 | BSL |
| `@kitsy/studio` | Visual builder UI | 3 | Proprietary |
| `@kitsy/canvas` | ViewNode editor model | 3 | Proprietary |
| `@kitsy/mind` | AI agent framework | 4 | Proprietary |
| `@kitsy/prompts` | Prompt templates, schema instructions | 4 | Proprietary |

**Total:** 20 open-source packages + 6 proprietary packages.

### 7.2 Org migration

| Step | Action |
|------|--------|
| 1 | Register `@kitsy` org on npm |
| 2 | Publish new versions under `@kitsy/blu-*` |
| 3 | Keep `@pkvsinha/react-*` as deprecated aliases for 6 months |
| 4 | Update all internal imports, package.json, documentation |
| 5 | Rename `window.ReactApp` → `window.Blu` in UMD bundle |

### 7.3 React coupling boundary

```
UNIVERSAL (renderer-agnostic — MUST stay DOM-free)
─────────────────────────────────────────────────
@kitsy/blu-bus          ✅ Zero DOM deps (confirmed)
@kitsy/blu-data         ✅ Design DOM-free from start
@kitsy/blu-types        ✅ Types only
@kitsy/blu-validate     ✅ Pure validation logic
@kitsy/blu-test         ✅ Headless utilities
@kitsy/blu-route        ✅ Adapter pattern (NavigationStore)
@kitsy/blu-wire         ✅ Transport only
@kitsy/blu-sync         ✅ Sync protocol only
@kitsy/blu-style        ⚠️ Token layer universal; CssBuilder is CSS-specific
@kitsy/blu-shell/core   ⚠️ Config compilation, action resolution — universal

REACT-SPECIFIC (clearly labeled, acceptable)
─────────────────────────────────────────────
@kitsy/blu-shell/react  React render(), SSR, BluProvider
@kitsy/blu-context      React hooks and Context API
@kitsy/blu-core         React components
@kitsy/blu-ui           React components
@kitsy/blu-grid         React layout components
@kitsy/blu-blocks       React widgets + form renderer
@kitsy/blu-icons        React SVG components
@kitsy/blu-templates    React page templates
@kitsy/blu-devtools     React UI (consumes universal bus)
```

**Package exports convention:**

```json
{
  "exports": {
    ".": "./dist/react/index.js",
    "./core": "./dist/core/index.js",
    "./react": "./dist/react/index.js"
  }
}
```

Default import gives React (no migration break). `/core` gives the universal layer.

---

## 8. Phased Roadmap

### 8.1 Dependency graph

```
Phase 0 (current → v0.1.0) — "Ship the Wedge"
    │
Phase 1 (v0.2.0) — "Data + Transport + Actions"
    │
Phase 2 (v0.3.0) — "Kitsy Server"
    │
    ├──> Phase 3 — "Kitsy Studio" (depends on Phase 2)
    │         │
    │         └──> Phase 4 — "Kitsy Mind / AI" (depends on Phase 3)
    │
    └──> Phase 5 — "Platform Services" (can start with Phase 2)
```

**Multi-platform (former Phase 6) is deferred** to a dedicated future discussion and removed from the active roadmap. The web story must be complete before considering additional surfaces.

### 8.2 Phase 0: Ship the Wedge (Current → v0.1.0)

**Objective:** Rebrand, stabilize, publish the first thing developers can use, establish schema discipline.

| Task | Deliverable |
|------|------------|
| Rebrand `@pkvsinha/react-*` → `@kitsy/blu-*` | Published packages on npm under `@kitsy` scope |
| Publish `@kitsy/blu-types` | TypeScript types + JSON Schema for ApplicationConfiguration, ViewNode, Action |
| Rename `window.ReactApp` → `window.Blu` | UMD bundle update |
| Add `$schema` and `$version` to ApplicationConfiguration | Schema versioning from day one |
| Split `blu-shell` into `/core` and `/react` exports | Universal/React boundary formalized |
| Add ViewNode parallel path (alongside `React.ReactNode`) | Config compiler resolves ViewNodes to React elements |
| Harden URL rendering: XSS sanitization, `_strict` validation | Section 4.3 security rules |
| Publish `@kitsy/blu-bus` as standalone (usable without rest of Blu) | Standalone EventBus library |
| Write "Getting Started" guide | 4 paths: CDN tag, URL render, npm install, full app |
| CI: bundle size budget check | Fail build if > 150KB gzipped (core) |
| CI: JSON Schema validation of example configs | Catch contract regressions |

**Phase 0 exit criteria:**
1. All packages published under `@kitsy/blu-*` on npm
2. `window.Blu.render(config)` works via CDN script tag
3. URL rendering works with `_strict=1` validation
4. ViewNode tree renders alongside existing ReactNode path
5. `@kitsy/blu-bus` usable standalone (npm install, import, dispatch, subscribe)
6. JSON Schema published and validating example configs in CI

### 8.3 Phase 1: Data + Transport + Actions (v0.2.0)

**Objective:** Blu becomes a complete application framework — not just a renderer.

| Task | Deliverable |
|------|------------|
| `@kitsy/blu-data` | Data source registry, adapters (rest, static, bus, state), binding resolution, caching |
| ViewNode `data`, `repeat`, `when` fields | Sections 6.2 and 6.5 |
| ViewNode `actions` field | Section 6.6 |
| Form contract in `@kitsy/blu-blocks` | Section 6.7 |
| `@kitsy/blu-wire` | Transport interface + WebSocket/BroadcastChannel/SSE adapters |
| Command envelope metadata (`$`-prefix fields) | Section 6.9 |
| `EventBus.attachTransport(transport)` | Network-transparent bus |
| `@kitsy/blu-validate` | Standalone validation (JSON Schema, URN resolution, circular reference check) |
| `@kitsy/blu-devtools` v1 | Bus inspector + state viewer (BroadcastChannel-connected) |
| `@kitsy/blu-test` | Config validation, headless rendering, bus simulation |
| `render(config, options)` with RenderOptions | Section 4.6 — the free/premium bridge |
| `@kitsy/blu-cli` | `blu dev`, `blu build`, `blu validate`, `blu export` |
| `@kitsy/create-blu` | `blu init my-app` scaffolder with templates |
| Migration chain infrastructure | Section 13 |
| Plugin contract formalization | Section 12 |
| Extensible `Command.type` (no longer fixed union) | Middleware-based type registration |
| Performance baselines measured in CI | Section 10 targets |

**Phase 1 exit criteria:**
1. Developer can load Blu via CDN and render a multi-page app with REST data
2. Developer can `npm install @kitsy/blu-shell` and build the same app with TypeScript
3. Developer can define forms, actions, conditional rendering, and data lists — all as JSON config
4. Developer can open Blu DevTools and see every bus command, state change, data fetch
5. Developer can add `{ platform: "kitsy" }` and the app becomes network-transparent
6. AI can generate a complete config that passes `blu validate` without errors
7. `blu init my-app` produces a working project with dev server

### 8.4 Phase 2: Kitsy Server (v0.3.0)

**Objective:** A Node.js server that is itself a Blu EventBus participant — manages sessions, stores configs, and acts as state authority.

**Architecture:**

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

**Key components:**

**Session Management:**

| Field | Type | Purpose |
|-------|------|---------|
| sessionId | string | Unique per connection |
| tenantId | string | Which kitsy.ai customer |
| userId | string | Authenticated user |
| transport | Transport | WebSocket/SSE connection |
| configVersion | number | Browser's current config version |
| stateSnapshot | object | Last known browser state |

**Config Store (Versioned):**

```typescript
interface ConfigStore {
  get(tenantId: string, siteId: string): Promise<VersionedConfig>;
  save(tenantId: string, siteId: string, config: ApplicationConfiguration): Promise<number>; // returns version
  diff(tenantId: string, siteId: string, fromVersion: number, toVersion: number): Promise<JSONPatch[]>;
  history(tenantId: string, siteId: string, limit: number): Promise<VersionEntry[]>;
  rollback(tenantId: string, siteId: string, toVersion: number): Promise<VersionedConfig>;
}
```

**State Synchronization Protocol:**

1. **Initial sync:** On connect, server sends full ApplicationConfiguration + state
2. **Incremental updates:** Server sends JSON Patch (RFC 6902) diffs
3. **Optimistic updates:** Browser applies locally, sends to server. Server validates, confirms or rejects with corrective patch
4. **Conflict resolution:** Last-writer-wins default; configurable merge semantics per-key

```
Sync commands (over the bus):

  Topic: "sync:config"
    server → browser: { version, patch: JSONPatch[] }
    browser → server: { ack: version }

  Topic: "sync:state"
    server → browser: { key, value, version }
    browser → server: { key, value, expectedVersion }
    server → browser: { key, value, version, conflict?: true }
```

**Command Routing:**

1. Auth middleware validates `meta.$auth` JWT
2. Route by `meta.$destination`: `"server"` → server effects, `"browser:xyz"` → specific session, `"tenant:*"` → all tenant sessions, `"*"` → broadcast
3. Append to command log for observability

**Runtime decision:** Node.js + `ws`. Reuses Blu EventBus code isomorphically (zero DOM deps in blu-bus). Migrate to Bun when mature.

**New packages:**
- `@kitsy/server` — Node.js server (separate repo, BSL)
- `@kitsy/blu-sync` — Client-side sync protocol (Apache 2.0)
- `@kitsy/protocol` — Shared wire types (BSL)

### 8.5 Phase 3: Kitsy Studio (No-Code Builder)

**Objective:** A visual editor that produces ApplicationConfiguration. The builder is itself a Blu app.

**Architecture:**

```
+-----------------------------------------------------------------------+
|                          Kitsy Studio                                  |
|  +------------------+  +------------------+  +--------------------+  |
|  |  Component       |  |  Canvas          |  |  Property Panel    |  |
|  |  Palette         |  |  (live preview)  |  |  (config editor)   |  |
|  |  (from Blu       |  |  (iframe running |  |  (JSON Schema UI)  |  |
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

**Core innovation:** The entire UI is a tree of ViewNodes referencing Blu components by URN with serializable props. This is what the LLM generates in Phase 4.

**Live preview:** iframe with same-origin — true isolation, accurate rendering. Preview receives ApplicationConfiguration via `postMessage` (another Blu Transport adapter).

**Template marketplace:** Templates are ApplicationConfiguration documents stored with `tenantId: "marketplace"`. Users browse → preview → fork.

**New packages:** `@kitsy/studio` (proprietary), `@kitsy/canvas` (proprietary)

### 8.6 Phase 4: Kitsy Mind (AI Integration)

**Objective:** AI becomes a first-class Blu bus participant. It generates ApplicationConfiguration from natural language.

**Key principle: AI is not special.** AI agents connect to the Kitsy Server EventBus like any other participant. `$source: "ai:agent-1"`. They use the same channels ask/answer RPC.

**Conversational builder flow:**

```
1. User in Kitsy Studio: "Create a landing page for my bakery"
2. Studio sends: ask("ai:generate-site", { prompt, availableComponents, themeTokens })
3. Mind constructs LLM prompt with ApplicationConfiguration schema + ComponentRegistry URNs
4. LLM returns: ApplicationConfiguration JSON with ViewNode trees
5. Mind validates against schema (blu-validate)
6. Mind responds via answer()
7. Studio applies → Server syncs → live preview updates
```

**AI agent types:**

| Agent | Subscribes To | Sends |
|-------|--------------|-------|
| Site Builder | `ai:generate-site`, `ai:edit-section` | Config patches |
| Theme Advisor | `ai:suggest-theme` | Token overrides |
| Content Writer | `ai:write-copy` | Text content patches |
| Analytics Agent | `analytics:*` | Insight reports |
| Form Builder | `ai:generate-form` | Form ViewNode configs |

**AI validation pipeline (guardrails):**

```
Every AI-generated config passes through:
1. JSON Schema validation         — structural correctness
2. URN resolution                 — all componentUrns exist in registry
3. Data source validation         — all source references exist in dataSources
4. Action validation              — all action targets are valid
5. Circular reference check       — no infinite ViewNode nesting
6. Render smoke test              — renders without errors in headless mode
7. Accessibility baseline         — required labels, alt text, heading hierarchy
```

**New packages:** `@kitsy/mind` (proprietary), `@kitsy/prompts` (proprietary)

### 8.7 Phase 5: Kitsy Platform Services

**Objective:** Full kitsy.ai hosted platform.

**Services:**

| Service | Responsibility | Bus Participant? |
|---------|---------------|-----------------|
| Auth & Identity | JWT, session management | Yes |
| Tenant Manager | Multi-tenant isolation | Yes (middleware) |
| Billing (Stripe) | Plans, subscriptions | No (REST API via server) |
| Domain Management | Registration, DNS | No (REST API via server) |
| Config Store | Versioned configs | Yes |
| Asset Store | Images, files | No (REST API) |
| CDN / Deploy | Static site publishing | No (build pipeline) |
| Analytics | Event tracking | Yes |
| CRM Service | Customer management | Future |
| Email Service | Notifications | No (REST API via server) |
| Plugin Runtime | Third-party plugins | Yes |
| Template Marketplace | Template ecosystem | Yes |

**Important boundary:** Services that the UI needs to interact with in real-time (config store, analytics, plugin runtime) are bus participants. Infrastructure services (billing, domain management, CDN deployment, email) use standard REST APIs invoked by Kitsy Server. This prevents the bus from becoming an Enterprise Service Bus bottleneck.

**Publish flow:**

1. ConfigStore retrieves latest ApplicationConfiguration
2. Blu `renderToStringSSR()` generates static HTML
3. CssBuilder generates CSS from theme tokens
4. Assets collected → uploaded to CDN (S3+CloudFront or Cloudflare R2)
5. DNS configured to point domain to CDN
6. For premium server-managed sites: persistent Kitsy Server handles WebSocket + hydration

---

## 9. Security Model

### 9.1 CDN / Free tier security

| Threat | Mitigation |
|--------|-----------|
| **Config injection via URL params** | Never `eval()` URL-loaded config. Whitelist allowed keys, validate against JSON Schema, sanitize all strings against XSS. URL-loaded configs treated as untrusted — no auth tokens. `_strict=1` required for production. |
| **Component registry poisoning** | ComponentRegistry validates URN format. In premium: server maintains allowlist per tenant. No `dangerouslySetInnerHTML` in registered components (lint rule). |
| **XSS via ViewNode props** | All string props are sanitized before DOM insertion. Component props are type-checked against `propSchema`. |

### 9.2 Premium tier security

| Threat | Mitigation |
|--------|-----------|
| **Bus command spoofing** | `$source` set by transport layer, never by sender. `$auth` JWT validated server-side on every command. `$sessionId` set by server on connection. Rate limiting per session. |
| **Cross-tenant data leakage** | Bus-level routing middleware extracts `tenantId` from JWT, filters all commands by tenant. Storage is tenant-partitioned. Cross-tenant routing impossible by design. |
| **JWT replay** | Short-lived tokens (15 min), refresh token rotation, server-side token blacklist on logout. |

### 9.3 CSP compatibility

```
Content-Security-Policy:
  script-src 'self' https://cdn.jsdelivr.net https://cdn.kitsy.ai;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' wss://rt.kitsy.ai;
```

CssBuilder injects `<style>` tags at runtime. For strict CSP: `blu build --extract-css` produces static CSS files.

### 9.4 Tenant isolation model (Kitsy Server)

```
Every command passes through:
1. Auth middleware → validate JWT
2. Tenant extraction → tenantId from JWT claims
3. Scope middleware → tag command with tenantId, reject cross-tenant access
4. Rate limiter → per-tenant quotas
5. Audit logger → all commands logged with tenant context

Storage is tenant-partitioned:
- ConfigStore: key = tenantId/siteId
- StateStore: key = tenantId/sessionId
- AssetStore: bucket prefix = tenantId/
```

---

## 10. Performance Architecture

### 10.1 Bundle performance targets

| Metric | Target | Enforcement |
|--------|--------|-------------|
| UMD core (gzipped) | < 150KB | CI budget check |
| UMD full (gzipped) | < 300KB | CI budget check |
| Time to Interactive (simple config) | < 1.5s | Lighthouse on 3G throttle |
| First Contentful Paint | < 0.8s | CDN-loaded, no server round-trip |

**Strategies:** Tree-shake icons, lazy-load blocks/templates, inline critical CSS, precompile configs at build time.

### 10.2 Bus performance targets

| Metric | Target |
|--------|--------|
| Local command dispatch latency | < 0.5ms |
| Transport round-trip (WebSocket, LAN) | < 50ms |
| Middleware chain (5 middlewares) | < 2ms total |
| Max commands/second (local) | > 10,000 |
| Max concurrent sessions (Kitsy Server) | > 10,000 per node |

### 10.3 Rendering performance

ViewNode tree diffing is O(patch) not O(tree):

1. JSON Patch arrives from server or state change
2. Patch paths mapped to affected ViewNode IDs
3. Only affected nodes re-resolved
4. React reconciler handles DOM diff on the subtree

### 10.4 Batching

Middleware collects commands for 50ms window, sends as array over transport. Reduces WebSocket frame overhead for chatty dispatch patterns.

---

## 11. Observability & Debugging

### 11.1 Blu DevTools

A bus-powered inspector that runs as a Blu app itself, connected via `BroadcastChannelTransport`:

- **Bus inspector:** Real-time command stream with filters. Click to see payload, middleware chain, effects.
- **Time travel:** Replay commands forward/backward (Redux DevTools for the entire bus).
- **State viewer:** Live globalState tree with diff highlighting.
- **Config explorer:** Interactive ApplicationConfiguration viewer. Click view → see ViewNode tree.
- **ViewNode tree:** Like React DevTools but for ViewNode schema — resolved props, data binding status, action wiring.
- **Performance:** Middleware latency heatmap, command frequency, data source cache hit rates.

### 11.2 Structured logging

```typescript
interface BusLogEntry {
  timestamp: number;
  command: { type: string; target: string; meta: Record<string, unknown> };
  source: string;
  destination: string;
  duration: number;
  middlewares: { name: string; duration: number; modified: boolean }[];
  effects: { name: string; triggered: boolean; duration?: number }[];
  error?: { code: string; message: string; stack?: string };
}
```

### 11.3 Distributed tracing (premium)

`$correlationId` links the full journey across browser → server → AI → browser. Kitsy dashboard renders the journey as a timeline.

### 11.4 Error boundaries

Every ViewNode renders inside an error boundary with contextual messages:

```
ViewNode 'product-list' (urn:blu:list) failed to render.
Data binding 'products' returned null.
Check DataSource 'products-api' at dataSources[2].
Last successful fetch: 14:23:01 (24 items).
Tip: Add an 'empty' component to handle no-data states.
```

---

## 12. Plugin Architecture

### 12.1 Plugin contract

```typescript
interface BluPlugin {
  name: string;
  version: string;

  capabilities?: {
    components?: boolean;
    effects?: boolean;
    middleware?: boolean;
    dataSources?: boolean;
    theme?: boolean;
    routes?: boolean;
  };

  install(context: PluginContext): void | Promise<void>;
  uninstall?(): void;
}

interface PluginContext {
  bus: EventBus;
  registry: ComponentRegistry;
  dataRegistry: DataSourceRegistry;
  themeBuilder: CssBuilder;
  navigationStore: NavigationStore;
  config: ApplicationConfiguration;

  // Scoped registration (namespaced to plugin)
  registerComponent(urn: string, component: unknown, meta?: ComponentMeta): void;
  registerEffect(name: string, effect: EffectFn): void;
  registerMiddleware(name: string, middleware: MiddlewareFn): void;
  registerDataAdapter(type: string, adapter: DataSourceAdapter): void;
}
```

### 12.2 Plugin isolation

- Plugin middleware runs in try-catch wrappers
- Plugin components render inside error boundaries
- Plugin bus commands tagged with `$source: "plugin:<name>"` — rate-limitable
- Plugin URNs namespaced: `"urn:plugin:<name>:<component>"` (cannot collide with `"urn:blu:*"`)
- Premium: marketplace plugins are reviewed and signed

---

## 13. Schema Versioning & Migration

### 13.1 Version field

```typescript
{
  "$schema": "https://blu.kitsy.ai/schema/v1.json",
  "$version": 1,
  // ... rest of config
}
```

Configs without `$version` are treated as v1.

### 13.2 Migration chain

```typescript
type Migration = {
  up: (config: unknown) => unknown;
  down: (config: unknown) => unknown;  // For rollback
};

const migrations: Record<number, Migration> = {
  2: {
    up: (c) => ({ ...c, $version: 2, navigation: c.navs, navs: undefined }),
    down: (c) => ({ ...c, $version: 1, navs: c.navigation, navigation: undefined }),
  },
};

function migrateConfig(config: unknown, targetVersion?: number): ApplicationConfiguration {
  let current = config;
  const from = current.$version || 1;
  const to = targetVersion || LATEST_VERSION;

  for (let v = from + 1; v <= to; v++) {
    if (migrations[v]) current = migrations[v].up(current);
  }

  return validateConfig(current);
}
```

### 13.3 Rules for schema evolution

1. New fields are always optional
2. Removing a field requires 2-version deprecation
3. Renaming = add new + migrate + deprecate old
4. `ext` bag is unversioned (escape hatch, governed)
5. Every migration is reversible (up + down)
6. Migrations run automatically on config load in Kitsy Server

---

## 14. Testing Strategy

### 14.1 Config testing utilities

```typescript
import { validateConfig, renderConfig, resolveViewTree } from "@kitsy/blu-test";

// Validate without rendering
const result = validateConfig(myConfig);
// { valid: true } or { valid: false, errors: [...] }

// Render in test environment
const { getByText, bus, state } = renderConfig(myConfig);
bus.dispatch({ type: "navigate", target: "/products" });
expect(state.get("cart.items")).toHaveLength(3);

// Snapshot the ViewNode tree (deterministic, renderer-independent)
expect(resolveViewTree(myConfig)).toMatchSnapshot();
```

### 14.2 AI generation validation pipeline

```
1. JSON Schema validation         — structural correctness
2. URN resolution                 — all componentUrns exist in registry
3. Data source validation         — all source references resolve
4. Action validation              — all action targets are valid
5. Circular reference check       — no infinite ViewNode nesting
6. Render smoke test              — headless render without errors
7. Accessibility baseline         — labels, alt text, heading hierarchy
```

---

## 15. Open Source & Licensing Strategy

### 15.1 License matrix

| Layer | License | Rationale |
|-------|---------|-----------|
| Blu framework (`@kitsy/blu-*`) | **Apache 2.0** | Permissive, patent protection, enterprise-friendly |
| Kitsy Server (self-hosted) | **BSL** | Source-available, converts to open source after 3-4 years. Prevents cloud competition. |
| kitsy.ai platform | **Proprietary** | SaaS — Terms of Service |
| AI components (Mind, Prompts) | **Proprietary** | Prompts, training data, agent logic are competitive advantages |

### 15.2 Why open-source Blu

- **Adoption funnel:** Developers try standalone packages, build trust, contribute. This is the pipeline into kitsy.ai.
- **Quality:** Community finds bugs, validates edge cases.
- **Hiring signal:** Good OSS attracts talent.
- **Standards play:** If `@kitsy/blu-bus` becomes the go-to EventBus for React, kitsy.ai has natural lock-in.
- **No competitive risk:** Blu without Kitsy is useful but not a business. Nobody will out-execute Kitsy on the platform layer.
- **Brand halo:** Every `@kitsy/blu-*` import reinforces the Kitsy brand without being pushy.

### 15.3 Why keep Kitsy proprietary

- **Moat:** No-code builder, AI agents, hosting, domain management are the value.
- **Data advantage:** User sites, templates, AI training data are proprietary assets.
- **Speed:** Iterate without open-source governance overhead.

---

## 16. Revenue Model

| Tier | What They Get | Price Model |
|------|--------------|-------------|
| **Free (OSS)** | Blu framework, self-hosted, all 4 distribution tiers | Free forever |
| **Starter** | kitsy.ai builder, 1 site, kitsy subdomain, static hosting | Free / freemium |
| **Pro** | Custom domain, server-managed state, AI builder (Mind), templates | $19-49/mo |
| **Business** | Multi-site, CRM, analytics, priority support, plugin marketplace | $99-199/mo |
| **Enterprise** | Self-hosted Kitsy Server (BSL), SLA, dedicated support, custom AI agents | Custom pricing |

**The free-to-premium gap is structural, not artificial.** Free tier is powerful for individuals. Premium value is multi-user collaboration, server-managed state, AI generation, managed hosting, SLA — business needs that teams have but individuals don't.

---

## 17. Competitive Landscape

### 17.1 Cluster A — Website/store builders (Shopify, Wix, Webflow, Framer)

Destination products first. Value is not built around exposing a general-purpose runtime. Blu doesn't compete here directly — Kitsy platform does, but differentiated by the schema-driven engine underneath.

### 17.2 Cluster B — Visual app builders (FlutterFlow, Softr, Retool)

Closed platforms. Blu's open-core model and portable config format give developers an escape hatch. Blu needs the data layer and form handling (now specified in this document) to compete.

### 17.3 Cluster C — AI-native generators (Lovable, Bolt, v0)

**This is where Blu's structural advantage is clearest.** These tools generate code. Code is hard to patch, validate, version, and collaborate on. Blu generates data (ViewNode trees). Data is diffable (JSON Patch), validatable (JSON Schema), versionable (config store), and AI-safe (constrained schema). The advantage increases with application complexity.

### 17.4 Closest conceptual neighbor: Builder.io

Content-CMS-first, not runtime-first. Doesn't have the EventBus/transport layer, server-managed state model, or AI-as-bus-participant architecture.

### 17.5 Competitive strategy

Position Blu as **infrastructure, not destination:**

1. Ship `@kitsy/blu-bus` as the best EventBus for React
2. Ship the ViewNode spec as an open standard proposal
3. Build Kitsy Studio as proof the contract works, not the primary product initially
4. Let the AI story emerge from schema discipline

---

## 18. Risks & Mitigations

### 18.1 Technical risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **React version coupling** | High | React compatibility matrix. ViewNode abstraction means components re-implementable. Renderer swappable long-term. |
| **Bundle size creep** | High | Hard size budget in CI. Lazy-load non-critical packages. |
| **Schema ossification** | High | Get v1 right before public launch. Migration chain from day one. JSON Schema validation prevents drift. |
| **Bus bottleneck** | Medium | Bus is thin dispatch, not data store. Heavy payloads use references. O(1) middleware. Batching. |
| **Single-maintainer risk** | High | This document is institutional knowledge. Comprehensive test suite. ADR log (Section 19). |
| **URL rendering abuse** | Medium | Size limits, strict validation, XSS sanitization, no auth tokens in URL configs. |

### 18.2 Business risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **OSS without community** | High | Ship narrow wedge first. Excellent docs. Indian developer community (home advantage). Discord from day one. |
| **Free tier cannibalization** | Medium | Free/premium gap is structural (individual vs. team needs), not artificial. |
| **Competitor moat via data/network effects** | High | Compete on developer adoption and AI-readiness, not network effects. |
| **AI commoditization** | Medium | Advantage is structural (schema-driven), not feature-level (chat UI). Increases with app complexity. |
| **Visual builder quality gap** | High | Don't build general-purpose pixel editor. Build config-aware editor that understands ViewNode semantics. "Less but better." |
| **Server infrastructure costs** | Medium | Free tier = no server. Starter = static hosting only. Pro = scale-to-zero (Durable Objects/Fly.io). Enterprise = dedicated, passed to customer. AI compute = per-request billing. |

### 18.3 Risks that are hard to solve

**Developer adoption chicken-and-egg:** Start with < 20 extremely polished components. Quality over quantity. Tailwind playbook: small core, excellent docs, passionate early community.

**Builder compared to Webflow:** Don't compete on visual polish. Compete on structural understanding — Studio knows what each component is and does. Different product, not a worse one.

---

## 19. Key Architectural Decisions (ADR Log)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| ADR-001 | Brand split | Blu (framework) vs Kitsy (platform) | Adoption ≠ lock-in; developers choose Blu freely |
| ADR-002 | npm scope | Single `@kitsy` org, `blu-` prefix | One org, one billing, clean separation |
| ADR-003 | Transport location | EventBus middleware + `attachTransport()` | Zero breaking changes to bus API |
| ADR-004 | Command envelope | `$`-prefixed meta keys | No schema change to Command type |
| ADR-005 | Server runtime | Node.js + `ws` | Reuses blu-bus isomorphically |
| ADR-006 | Config diffing | JSON Patch (RFC 6902) | Standard, minimal payload |
| ADR-007 | Builder preview | iframe (same-origin) | True isolation, accurate rendering |
| ADR-008 | AI pattern | Bus participant via channels | AI is just another endpoint |
| ADR-009 | View serialization | ViewNode tree + URNs | Serializable, LLM-generatable, renderer-agnostic |
| ADR-010 | Tenant isolation | Bus-level routing middleware | Single enforcement point |
| ADR-011 | Schema evolution | $version + migration chain | Never breaks stored configs |
| ADR-012 | Data layer | DataSource adapters (Strategy pattern) | Open/Closed; new adapters without core changes |
| ADR-013 | Actions | Serializable Action union type | Transitions as data; AI-generatable, inspectable |
| ADR-014 | Forms | Schema-driven FormField declarations | AI generates field specs, not onChange handlers |
| ADR-015 | React boundary | blu-shell/core (universal) vs /react | Future renderer swap possible without rewrite |
| ADR-016 | URL rendering | ?_render=base64 auto-render | Zero-hosting distribution; compliance, AI links |
| ADR-017 | UMD global | `window.Blu` (single namespace) | Clean API surface; bundles own React |
| ADR-018 | DevTools | Separate Blu app via BroadcastChannel | Eats own cooking; zero performance impact |
| ADR-019 | Bus vs REST for platform services | Bus for real-time UI concerns; REST for infrastructure | Prevents ESB bottleneck pattern |
| ADR-020 | Plugin isolation | Try-catch wrappers, error boundaries, namespaced URNs | Plugin failure doesn't crash host app |

---

## 20. Appendix: SOLID & Principles Checklist

| Principle | Application in Blu |
|-----------|-------------------|
| **S — Single Responsibility** | Each `@kitsy/blu-*` package has ONE concern. Bus doesn't render. Renderer doesn't route. |
| **O — Open/Closed** | ComponentRegistry, DataSourceRegistry, plugin system, middleware chain — all extensible without modifying core. |
| **L — Liskov Substitution** | All Transports are substitutable. All DataSource adapters are substitutable. All renderers (future) are substitutable. |
| **I — Interface Segregation** | Developers needing only the bus don't import the renderer. Individual packages standalone. |
| **D — Dependency Inversion** | ViewNodes → URNs (not components). DataBindings → source IDs (not adapters). Actions → type strings (not functions). |
| **Convention over Configuration** | `render(config)` works with minimal config. Sensible defaults everywhere. |
| **Principle of Least Surprise** | Free config works on premium. Premium works on free (minus server). Same API across all tiers. |
| **Fail Gracefully** | Invalid URN → placeholder. Missing data → loading state. Plugin error → contained. |
| **Eat Your Own Cooking** | DevTools is a Blu app. Studio is a Blu app. Docs should be a Blu app. |
| **Schema-First** | Define contracts (types, JSON Schema) before implementing. Most important discipline for AI-readiness. |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-22 | Product Foundation (working draft) |
| 1.1 | 2026-03-22 | Architectural Roadmap (v1.2 draft) |
| 1.2 | 2026-03-22 | Gap-fill and hardening supplement |
| **2.0** | **2026-03-22** | **Consolidated single source of truth (this document). Supersedes all prior drafts.** |

---

*Blu is the engine. Kitsy is the car. The config is the road.*
