# Blu / Kitsy — Architectural Gap-Fill, Hardening & Sustainability Guide

**Version:** 1.0  
**Date:** 2026-03-22  
**Purpose:** Fill identified gaps, harden the architecture for production sustainability, address risks with concrete mitigations, and formalize the CDN-first distribution model as a core architectural pillar.  
**Relationship to existing docs:** This supplements the Product Foundation and Architectural Roadmap documents. It does not replace them — it resolves their open questions and adds missing layers.

---

## 0. The Missing Pillar: CDN-First Distribution Model

The existing documents describe Blu as a framework but understate what is arguably its most powerful distribution advantage: **Blu already works as a zero-install, CDN-delivered runtime where the entire application is a data contract passed to `render()`.**

```html
<script src="https://cdn.jsdelivr.net/npm/@pkvsinha/react-app@0.0.7/dist/umd/react-app.standalone.min.js"></script>
<script>
  const { render, React, ReactDOM } = window.ReactApp;
  render({
    brand: "My Business",
    views: [{ id: "home", view: "Welcome" }],
  });
</script>
```

This is not a minor detail. This is the foundation of the entire free-to-premium funnel and must be formalized as a first-class architectural concern.

### 0.1 The Three Distribution Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTION MODEL                           │
│                                                                 │
│  TIER 1: CDN / UMD (Free, zero-install)                        │
│  ─────────────────────────────────────                          │
│  • Single <script> tag                                          │
│  • render(config) — config IS the app                           │
│  • No build tooling required                                    │
│  • Self-hosted, user controls infra                             │
│  • Blu bundles React + ReactDOM internally                      │
│  • Target: solo devs, small businesses, quick prototypes        │
│                                                                 │
│  TIER 2: npm / ESM (Free, developer-grade)                      │
│  ─────────────────────────────────────────                      │
│  • npm install @kitsy/blu-shell                                 │
│  • Tree-shakeable, build-tool integrated                        │
│  • Individual packages consumable standalone                    │
│  • Full TypeScript support                                      │
│  • Target: professional developers, app teams                   │
│                                                                 │
│  TIER 3: kitsy.ai Platform (Premium)                            │
│  ────────────────────────────────────                           │
│  • Same render(config) contract                                 │
│  • + Kitsy Server (state sync, auth, persistence)               │
│  • + Kitsy Studio (visual builder)                              │
│  • + Kitsy Mind (AI generation, patching, agents)               │
│  • + Platform services (domains, CDN, analytics, CRM)           │
│  • + Dashboard, billing, multi-tenant                           │
│  • Target: businesses wanting managed experience                │
│                                                                 │
│  KEY PRINCIPLE: The ApplicationConfiguration contract is        │
│  identical across all three tiers. A Tier 1 config works on     │
│  Tier 3. A Tier 3 config works on Tier 1 (minus server          │
│  features). The upgrade path is seamless.                       │
└─────────────────────────────────────────────────────────────────┘
```

### 0.2 The UMD Bundle Architecture

The standalone UMD bundle must be treated as a production artifact, not a convenience build.

**Bundle composition:**

```
@kitsy/blu-shell.standalone.min.js
├── react (pinned version, not externalized)
├── react-dom
├── @kitsy/blu-bus (EventBus, Effects, Channels)
├── @kitsy/blu-core (primitives)
├── @kitsy/blu-ui (component library)
├── @kitsy/blu-route (navigation)
├── @kitsy/blu-style (theme, tokens, CSS builder)
├── @kitsy/blu-context (hooks, AppContext)
├── @kitsy/blu-grid (layout)
├── @kitsy/blu-icons (icon subset — tree-shake for UMD)
├── @kitsy/blu-blocks (widgets)
└── Exposes: window.Blu = { render, React, ReactDOM, EventBus, ... }
```

**Critical design rules for the UMD bundle:**

1. **Single global namespace:** `window.Blu` (rename from `window.ReactApp`). Expose `render` as the primary entry, plus escape hatches for `React`, `ReactDOM`, `EventBus` for power users.

2. **Version-locked React:** The UMD bundle pins its own React version internally. Users don't install React. This eliminates the #1 friction point for non-developer users.

3. **Size budget:** The standalone bundle must have a hard size budget. Target: < 150KB gzipped for the core (render + bus + base components + theme). Lazy-load `blu-blocks`, `blu-icons`, and `blu-templates` on demand.

4. **CDN strategy:** Publish to both npm (for jsDelivr/unpkg auto-CDN) and optionally a Kitsy-managed CDN (`cdn.kitsy.ai/blu@version/blu.min.js`) for premium users who need SLA guarantees.

5. **Upgrade bridge:** The UMD bundle should detect `window.__KITSY_PLATFORM__` and auto-attach the transport layer if the page is served from kitsy.ai. This is the zero-friction free-to-premium bridge.

### 0.3 The Free → Premium Upgrade Contract

```
FREE MODE (Tier 1 or 2):
  render(config)
  → Blu runs entirely client-side
  → EventBus is local only (LocalTransport)
  → No server sync, no auth, no persistence
  → User self-hosts the HTML/JS

PREMIUM MODE (Tier 3):
  render(config, { 
    platform: "kitsy",
    endpoint: "wss://rt.kitsy.ai",
    token: "<jwt>"
  })
  → Blu auto-attaches WebSocketTransport
  → EventBus becomes network-transparent
  → Config syncs from Kitsy Server (versioned)
  → State sync, auth middleware, AI agents activate
  → Kitsy dashboard manages the site
```

**The contract is the same `render(config)` call.** The second argument opts into platform features. This is the Principle of Least Surprise — nothing breaks when you upgrade, nothing is wasted when you're free.

**Formalize this as:**

```typescript
interface RenderOptions {
  platform?: "standalone" | "kitsy";
  endpoint?: string;          // WebSocket URL for Kitsy Server
  token?: string;             // JWT for authentication
  transport?: Transport;      // Custom transport (advanced)
  mode?: "browser" | "ssr";   // Rendering mode
  onReady?: (ctx: AppContext) => void;
}

function render(
  config: ApplicationConfiguration, 
  options?: RenderOptions
): AppInstance;
```

---

## 1. GAP: The Data Layer

### 1.1 Problem Statement

The current `ApplicationConfiguration` has a `dataSources` field, but no specification for how ViewNodes declare data dependencies, how data is fetched, or how mutations flow. Without this, Blu is a rendering engine but not an application framework.

### 1.2 Design Principles (SOLID + Domain-Driven)

- **Single Responsibility:** Data fetching is separate from rendering. ViewNodes declare what data they need; the runtime resolves it.
- **Open/Closed:** New data source types can be added without modifying the core data layer.
- **Dependency Inversion:** ViewNodes depend on abstract data contracts, not concrete fetch implementations.
- **Strategy Pattern:** Data source adapters are interchangeable (REST, GraphQL, Supabase, static, bus-driven).

### 1.3 The Data Contract

```typescript
// ─── Data Source Definition (in ApplicationConfiguration.dataSources) ───

interface DataSource {
  id: string;                          // "products", "user-profile", "blog-posts"
  type: string;                        // Adapter key: "rest", "graphql", "supabase", "static", "bus"
  config: Record<string, unknown>;     // Adapter-specific config
  
  // Caching
  cache?: {
    ttl?: number;                      // Seconds. 0 = no cache
    staleWhileRevalidate?: boolean;    // Serve stale, refresh in background
    scope?: "global" | "view" | "session"; // Cache isolation level
  };
  
  // Polling / real-time
  refresh?: {
    interval?: number;                 // Poll interval in ms (0 = manual only)
    on?: string[];                     // Bus event types that trigger refresh
  };
  
  // Schema (for validation and AI generation)
  schema?: JSONSchema;                 // Describes shape of returned data
}

// ─── Data Source Adapter (Strategy Pattern) ───

interface DataSourceAdapter<TConfig = unknown> {
  type: string;                        // Matches DataSource.type
  
  fetch(
    config: TConfig, 
    params: Record<string, unknown>,   // Runtime parameters (pagination, filters)
    context: DataContext                // Auth token, tenant, locale
  ): Promise<DataResult>;
  
  mutate?(
    config: TConfig,
    action: string,                    // "create", "update", "delete", or custom
    payload: unknown,
    context: DataContext
  ): Promise<MutationResult>;
  
  subscribe?(                          // For real-time sources (WebSocket, Supabase realtime)
    config: TConfig,
    handler: (data: DataResult) => void,
    context: DataContext
  ): Unsubscribe;
}

interface DataResult {
  data: unknown;
  meta?: {
    total?: number;                    // For pagination
    cursor?: string;                   // For cursor-based pagination
    hasMore?: boolean;
    fetchedAt: number;                 // Epoch ms
  };
  error?: { code: string; message: string };
}

interface MutationResult {
  success: boolean;
  data?: unknown;                      // Updated record
  error?: { code: string; message: string };
  optimisticRollback?: () => void;     // If optimistic update was applied
}

// ─── ViewNode Data Binding ───

interface ViewNodeDataBinding {
  source: string;                      // DataSource.id reference
  params?: Record<string, unknown>;    // Static or dynamic params
  
  // Mapping: how source data maps to component props
  mapping?: {
    prop: string;                      // Target prop name on the component
    path?: string;                     // JSONPath or dot-notation into result data
    transform?: string;                // Named transform function from registry
  }[];
  
  // Loading states
  loading?: {
    component?: string;                // URN of loading component
    props?: Record<string, unknown>;
  };
  
  // Error states
  error?: {
    component?: string;                // URN of error component
    props?: Record<string, unknown>;
    retry?: boolean;                   // Show retry button
  };
  
  // Empty states
  empty?: {
    component?: string;
    props?: Record<string, unknown>;
  };
}
```

### 1.4 How ViewNodes Consume Data

Extend the existing `ViewNode` contract:

```typescript
interface ViewNode {
  id: string;
  componentUrn: string;
  props: Record<string, unknown>;
  children?: ViewNode[];
  slot?: string;
  style?: Record<string, unknown>;
  responsive?: Record<BreakpointKey, Partial<ViewNode>>;
  
  // NEW: Data binding
  data?: ViewNodeDataBinding;
  
  // NEW: Repeater (for lists)
  repeat?: {
    source: string;                    // DataSource.id
    params?: Record<string, unknown>;
    as: string;                        // Variable name for each item: "product", "post"
    key: string;                       // Path to unique ID in each item
    template: ViewNode;                // Template for each item
    pagination?: {
      type: "infinite-scroll" | "load-more" | "numbered";
      pageSize: number;
    };
  };
  
  // NEW: Conditional rendering
  when?: {
    source?: string;                   // DataSource.id or state key
    path?: string;                     // Dot-notation path
    operator: "exists" | "eq" | "neq" | "gt" | "lt" | "in" | "empty" | "notEmpty";
    value?: unknown;
  };
}
```

### 1.5 Built-in Data Source Adapters

```typescript
// Register during app bootstrap
dataRegistry.register("rest", RestAdapter);
dataRegistry.register("graphql", GraphQLAdapter);
dataRegistry.register("static", StaticAdapter);        // Inline JSON data
dataRegistry.register("bus", BusAdapter);               // Data via EventBus ask/answer
dataRegistry.register("supabase", SupabaseAdapter);     // Optional, lazy-loaded
dataRegistry.register("state", StateAdapter);            // Read from globalState

// Users and plugins can register custom adapters
dataRegistry.register("my-custom-api", MyAdapter);
```

### 1.6 The Bus Data Adapter (Critical for Premium Mode)

In premium mode, the server can be the data authority:

```typescript
// BusAdapter: Uses EventBus channels to fetch data from Kitsy Server
class BusAdapter implements DataSourceAdapter {
  type = "bus";
  
  async fetch(config, params, context) {
    // ask() sends a command via the bus transport
    // In free mode: handled by local effects
    // In premium mode: routed to Kitsy Server via WebSocket
    const result = await channels.ask(config.topic, {
      action: "fetch",
      params,
      ...context
    });
    return result;
  }
  
  async mutate(config, action, payload, context) {
    return channels.ask(config.topic, { action, payload, ...context });
  }
}
```

This means the same data binding in a ViewNode works in both free mode (with a local REST adapter) and premium mode (with server-mediated data), depending on the DataSource configuration.

### 1.7 Package

- **`@kitsy/blu-data`** — Data source registry, adapter interface, built-in adapters (rest, static, bus, state), data binding resolution, caching layer. Consumes `@kitsy/blu-bus` for the bus adapter.
- **License:** Apache 2.0 (part of the open framework)
- **Phase:** 1 (required before Studio or AI generation can work)

---

## 2. GAP: Forms and Validation

### 2.1 Problem Statement

Business applications (CRM, operational dashboards, storefronts) are form-heavy. Without a schema-driven form contract, the builder and AI cannot generate functional business apps.

### 2.2 The Form Contract (ViewNode Extension)

```typescript
// A form is a ViewNode with type="form" semantics

interface FormViewNode extends ViewNode {
  componentUrn: "urn:blu:form";        // Or registered custom form component
  
  form: {
    id: string;                         // Form instance ID
    
    fields: FormField[];
    
    // Submission
    submit: {
      target: string;                   // DataSource.id or bus topic
      action: string;                   // "create", "update", custom
      method?: "optimistic" | "pessimistic"; // Default: pessimistic
      
      // Transforms before submission
      transform?: string;              // Named transform: "flattenAddress", etc.
      
      // Post-submission behavior
      onSuccess?: FormAction;
      onError?: FormAction;
    };
    
    // Validation
    validation?: {
      mode: "onBlur" | "onChange" | "onSubmit";  // When to validate
      debounce?: number;                          // ms, for onChange
    };
    
    // Layout
    layout?: "vertical" | "horizontal" | "grid";
    columns?: number;                    // For grid layout
  };
}

interface FormField {
  id: string;                           // Field key (maps to payload key)
  type: "text" | "email" | "password" | "number" | "date" | "select" 
      | "multiselect" | "checkbox" | "radio" | "textarea" | "file"
      | "tel" | "url" | "color" | "range" | "toggle" | "rich-text";
  label: string;
  placeholder?: string;
  defaultValue?: unknown;
  
  // Validation rules (JSON Schema compatible)
  rules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;                   // Regex
    custom?: string;                    // Named validator from registry
    message?: string;                   // Custom error message
  };
  
  // Conditional visibility
  when?: ViewNode["when"];              // Same condition model as ViewNode
  
  // Options for select/radio/checkbox
  options?: FormFieldOption[] | {
    source: string;                     // DataSource.id
    labelPath: string;                  // Dot-path to label in source data
    valuePath: string;                  // Dot-path to value
  };
  
  // Layout hints
  span?: number;                        // Column span in grid layout
  group?: string;                       // Fieldset grouping
}

interface FormFieldOption {
  label: string;
  value: unknown;
  disabled?: boolean;
}

type FormAction = 
  | { type: "navigate"; path: string }
  | { type: "bus"; command: string; payload?: Record<string, unknown> }
  | { type: "toast"; message: string; variant: "success" | "error" | "info" }
  | { type: "reset" }
  | { type: "close" };                  // For modal/drawer forms
```

### 2.3 Form State Management

Form state lives in the EventBus, not in component-local state. This is critical for the bus-first architecture.

```typescript
// Form state commands on the EventBus
type FormCommand =
  | { type: "form:init"; target: formId; payload: { fields, defaultValues } }
  | { type: "form:change"; target: formId; payload: { field, value } }
  | { type: "form:validate"; target: formId; payload: { field? } }
  | { type: "form:submit"; target: formId }
  | { type: "form:reset"; target: formId }
  | { type: "form:error"; target: formId; payload: { field, message } }
  | { type: "form:success"; target: formId; payload: { result } };

// Form state shape (in globalState or scoped state)
interface FormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: boolean;
  submitting: boolean;
  submitted: boolean;
  valid: boolean;
}
```

### 2.4 Why This Matters for AI

An AI agent generating a "contact form" produces this:

```json
{
  "componentUrn": "urn:blu:form",
  "form": {
    "id": "contact",
    "fields": [
      { "id": "name", "type": "text", "label": "Name", "rules": { "required": true } },
      { "id": "email", "type": "email", "label": "Email", "rules": { "required": true } },
      { "id": "message", "type": "textarea", "label": "Message", "rules": { "minLength": 10 } }
    ],
    "submit": { "target": "contact-api", "action": "create", "onSuccess": { "type": "toast", "message": "Sent!", "variant": "success" } }
  }
}
```

This is validatable, diffable, versionable. Compare to what Lovable/Bolt would generate: 50 lines of React code with useState, onChange handlers, fetch calls, and error handling — all of which is brittle to edit.

### 2.5 Package

- **Belongs in `@kitsy/blu-blocks`** (forms are higher-level building blocks) or a new **`@kitsy/blu-forms`** if the surface area justifies it.
- Form validation engine should be standalone and usable without UI: `@kitsy/blu-validate` (useful for server-side validation in Kitsy Server).

---

## 3. GAP: The Action / Transition System

### 3.1 Problem Statement

The core thesis includes "transitions as data." The EventBus handles command dispatch, but the documents don't formalize how ViewNodes declare user-initiated actions (button clicks, form submissions, navigation) in a serializable way.

### 3.2 The Action Contract

```typescript
// Actions are serializable descriptions of "what happens when the user does X"

type Action =
  | NavigateAction
  | BusAction
  | MutateAction
  | StateAction
  | FormAction
  | CompositeAction;

interface NavigateAction {
  type: "navigate";
  path: string;                        // Route path
  params?: Record<string, unknown>;
  replace?: boolean;                   // Replace vs push
}

interface BusAction {
  type: "bus";
  command: string;                     // Command type on EventBus
  target?: string;                     // Command target
  payload?: Record<string, unknown>;
  meta?: Record<string, unknown>;      // Includes $destination for remote
}

interface MutateAction {
  type: "mutate";
  source: string;                      // DataSource.id
  action: string;                      // "create", "update", "delete", custom
  payload?: Record<string, unknown>;
  onSuccess?: Action;
  onError?: Action;
}

interface StateAction {
  type: "state";
  operation: "set" | "merge" | "toggle" | "increment" | "append" | "remove";
  key: string;                         // Dot-path into globalState
  value?: unknown;
}

interface CompositeAction {
  type: "sequence" | "parallel";
  actions: Action[];                   // Execute in order or simultaneously
}

// ─── How ViewNodes Use Actions ───

interface ViewNode {
  // ... existing fields ...
  
  // NEW: Event-to-action mapping
  actions?: {
    onClick?: Action;
    onSubmit?: Action;
    onLoad?: Action;                   // Fired when ViewNode mounts
    onVisible?: Action;                // Fired when ViewNode enters viewport (analytics)
    onChange?: Action;
    onHover?: Action;
    [customEvent: string]: Action | undefined;
  };
}
```

### 3.3 Action Resolution at Runtime

The Blu shell resolves actions at render time:

```typescript
// Pseudocode: how the renderer processes actions
function resolveAction(action: Action, context: AppContext): () => void {
  switch (action.type) {
    case "navigate":
      return () => navigationStore.navigate(action.path, action.params);
    case "bus":
      return () => eventBus.dispatch({ 
        type: action.command, 
        target: action.target, 
        payload: action.payload,
        meta: action.meta 
      });
    case "mutate":
      return () => dataRegistry.mutate(action.source, action.action, action.payload);
    case "state":
      return () => stateManager[action.operation](action.key, action.value);
    case "sequence":
      return async () => {
        for (const a of action.actions) {
          await resolveAction(a, context)();
        }
      };
    case "parallel":
      return () => Promise.all(action.actions.map(a => resolveAction(a, context)()));
  }
}
```

### 3.4 Why This Matters

With this, the entire application behavior is data:

- **UI structure** → ViewNode tree
- **Data dependencies** → DataSource + data bindings
- **User interactions** → Action declarations
- **State transitions** → StateAction + bus commands
- **Navigation** → NavigateAction

An AI can generate a complete, functional application as a JSON document. A visual builder can wire actions through dropdowns. The server can validate that actions are authorized. Everything is inspectable, diffable, versionable.

---

## 4. GAP: Developer Experience (DX)

### 4.1 CLI Tooling

```
@kitsy/create-blu              # Project scaffolder (like create-react-app)
  blu init my-app               # Scaffold with templates
  blu init my-app --template storefront
  blu init my-app --template dashboard
  blu init my-app --template blank

@kitsy/blu-cli                  # Dev tooling
  blu dev                       # Dev server with HMR
  blu build                     # Production build (ESM + UMD)
  blu validate                  # Validate ApplicationConfiguration against schema
  blu inspect                   # Print config analysis (unused data sources, orphan views)
  blu export                    # Export config as standalone HTML (Tier 1 artifact)
  blu theme preview             # Live theme token preview
```

### 4.2 DevTools (Browser Extension or Embedded Panel)

**`@kitsy/blu-devtools`** — A bus-powered inspector that runs as a Blu app itself:

```
┌─────────────────────────────────────────────────────┐
│ Blu DevTools                                        │
├──────────┬──────────┬────────────┬─────────────────┤
│ Bus      │ State    │ Config     │ ViewNode Tree    │
│ Inspector│ Viewer   │ Explorer   │ Inspector        │
├──────────┴──────────┴────────────┴─────────────────┤
│                                                     │
│  [14:23:01] navigate → /products  [$src: browser:1] │
│  [14:23:01] data:fetch → products-api               │
│  [14:23:02] data:success → 24 items                 │
│  [14:23:05] form:change → search { q: "blue" }      │
│  [14:23:05] data:fetch → products-api { q: "blue" } │
│  [14:23:06] data:success → 3 items                  │
│                                                     │
│  Filter: [type ▾] [target ▾] [source ▾]             │
│  Time travel: [◀ ■ ▶] command #47 of 152            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Key features:**

- **Bus inspector:** Real-time command stream with filters. Click a command to see full payload, middleware chain, and effects triggered.
- **Time travel:** Replay commands forward/backward. Like Redux DevTools but for the entire bus.
- **State viewer:** Live globalState tree with diff highlighting on change.
- **Config explorer:** Interactive ApplicationConfiguration viewer. Click a view to see its ViewNode tree, data bindings, and actions.
- **ViewNode tree:** Like React DevTools component tree but for the ViewNode schema. Shows resolved props, data binding status, and action wiring.
- **Performance:** Middleware latency heatmap, command frequency chart, data source cache hit rates.

**Implementation:** The DevTools connect via `BroadcastChannelTransport` (cross-tab, zero network overhead). The inspected app and devtools are two separate Blu bus participants communicating through the existing transport layer. This is "eating your own cooking."

### 4.3 Error Boundaries and Developer-Friendly Errors

```typescript
// Every ViewNode renders inside an error boundary
// Errors show: which ViewNode failed, which data binding or action caused it, 
// and a direct link to the relevant config path

// Bad: "Cannot read property 'map' of undefined"
// Good: "ViewNode 'product-list' (urn:blu:list) failed to render. 
//        Data binding 'products' returned null. 
//        Check DataSource 'products-api' config at dataSources[2].
//        Last successful fetch: 14:23:01 (24 items).
//        Tip: Add an 'empty' component to handle no-data states."
```

### 4.4 TypeScript Schema Package

**`@kitsy/blu-types`** — Published as a standalone types-only package:

```typescript
// Developers get full autocomplete and validation when authoring configs
import type { ApplicationConfiguration, ViewNode, Action, DataSource } from "@kitsy/blu-types";

const config: ApplicationConfiguration = {
  // Full IntelliSense here
};
```

This also serves as the canonical schema that AI uses to generate configs — the same TypeScript types can be converted to JSON Schema for LLM prompting.

---

## 5. GAP: React Coupling Audit

### 5.1 The Boundary Map

```
UNIVERSAL (renderer-agnostic, must stay clean)
─────────────────────────────────────────────
@kitsy/blu-bus          ✅ Zero DOM deps (confirmed)
@kitsy/blu-data         ✅ (new, design DOM-free from start)
@kitsy/blu-types        ✅ Types only
@kitsy/blu-route        ✅ Adapter pattern (NavigationStore)
@kitsy/blu-style        ⚠️ Token layer universal; CssBuilder is DOM/CSS-specific
@kitsy/blu-shell        ⚠️ Config compilation universal; render() is React-specific

REACT-SPECIFIC (acceptable, clearly labeled)
─────────────────────────────────────────────
@kitsy/blu-context      ❌ React hooks and Context API
@kitsy/blu-core         ❌ React components (Box, Text, Container)
@kitsy/blu-ui           ❌ React components
@kitsy/blu-grid         ❌ React layout components
@kitsy/blu-blocks       ❌ React widgets
@kitsy/blu-icons        ❌ React SVG components
@kitsy/blu-templates    ❌ React page templates
```

### 5.2 The Split Strategy

**`@kitsy/blu-shell` needs an internal split:**

```typescript
// UNIVERSAL (exported from @kitsy/blu-shell/core)
compileConfig(raw: ApplicationConfiguration): CompiledConfig;
resolveViewNode(node: ViewNode, registry: ComponentRegistry): ResolvedNode;
resolveAction(action: Action, context: ActionContext): ActionHandler;
resolveDataBinding(binding: DataBinding, dataRegistry: DataRegistry): BoundData;

// REACT-SPECIFIC (exported from @kitsy/blu-shell or @kitsy/blu-shell/react)
render(config: ApplicationConfiguration, options?: RenderOptions): void;
renderToStringSSR(config: ApplicationConfiguration): string;
BluProvider: React.FC;
useAppContext(): AppContext;
```

**Rule:** Any code that references `React`, `ReactDOM`, `createElement`, hooks, or DOM APIs must live in a `/react` sub-path or a React-specific package. The universal config compilation, action resolution, and data binding logic must be DOM-free.

**Why this matters now (not in Phase 6):** If AI agents running on the server need to validate a generated config, they need `compileConfig()` and `resolveViewNode()` without importing React. If a Flutter renderer is ever built, it needs the same compilation logic. Getting this boundary right in Phase 0-1 is cheap; fixing it later is expensive.

### 5.3 Package Exports Convention

```json
// @kitsy/blu-shell package.json
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

## 6. GAP: Security Model (Hardened)

### 6.1 CDN / Free Tier Security

The CDN distribution model means configs are client-side and visible. Security concerns:

```
THREAT: Config injection via URL parameters
  The existing ?_render= URL parameter pattern suggests config can come from the URL.
  
MITIGATION:
  - Never eval() or new Function() config from URL params
  - If accepting config via URL: whitelist allowed keys, validate against JSON Schema,
    sanitize all string values against XSS
  - Document that URL-loaded configs are untrusted and should not contain auth tokens
  - Default: disable URL config loading; require explicit opt-in

THREAT: Component registry poisoning
  A malicious plugin or third-party component could register a URN that executes arbitrary code.
  
MITIGATION:
  - ComponentRegistry.register() should validate URN format (enforce namespace rules)
  - In premium mode: Kitsy Server maintains an allowlist of registered URNs per tenant
  - Component rendering sandbox: ViewNode props are sanitized before passing to components
  - No dangerouslySetInnerHTML allowed in registered components (lint rule)

THREAT: Bus command spoofing (premium mode)
  Malicious browser code sends commands with forged $source or $auth.
  
MITIGATION:
  - $source is ALWAYS set by the transport layer, never by the sender
  - $auth JWT is validated server-side on every command; expired/invalid = reject
  - $sessionId is set by the server on connection; browser cannot forge it
  - Rate limiting per session at the server gateway
```

### 6.2 Content Security Policy (CSP) Compatibility

The UMD bundle must work with strict CSP headers:

```
Content-Security-Policy: 
  script-src 'self' https://cdn.jsdelivr.net https://cdn.kitsy.ai;
  style-src 'self' 'unsafe-inline';   // Required for CssBuilder runtime injection
  connect-src 'self' wss://rt.kitsy.ai;
```

**Action item:** CssBuilder currently injects `<style>` tags at runtime. For strict CSP environments that disallow `'unsafe-inline'`, provide a build-time CSS extraction option via the CLI (`blu build --extract-css`).

### 6.3 Tenant Isolation (Premium Mode)

```
┌─────────────────────────────────────────────┐
│ Kitsy Server — Tenant Isolation Model       │
│                                             │
│  Every command passes through:              │
│  1. Auth middleware (validate JWT)          │
│  2. Tenant extraction (tenantId from JWT)   │
│  3. Scope middleware (tag command with       │
│     tenantId, reject cross-tenant access)   │
│  4. Rate limiter (per-tenant quotas)        │
│  5. Audit logger (all commands logged)      │
│                                             │
│  Storage is tenant-partitioned:             │
│  - ConfigStore: key = tenantId/siteId       │
│  - StateStore: key = tenantId/sessionId     │
│  - AssetStore: bucket prefix = tenantId/    │
│                                             │
│  Bus routing is tenant-scoped:              │
│  - "$destination: tenant:*" only reaches    │
│    sessions in the SAME tenant              │
│  - Cross-tenant routing is impossible by    │
│    design (middleware strips/rejects)       │
└─────────────────────────────────────────────┘
```

---

## 7. GAP: Performance Architecture

### 7.1 Bundle Performance (Free Tier)

| Metric | Target | Measurement |
|--------|--------|-------------|
| UMD bundle size (core, gzipped) | < 150KB | `blu build --analyze` |
| UMD bundle size (full, gzipped) | < 300KB | Including all blocks, icons, templates |
| Time to Interactive (simple config) | < 1.5s | Lighthouse on 3G throttle |
| First Contentful Paint | < 0.8s | CDN-loaded, no server round-trip |

**Strategies:**
- Tree-shake icons aggressively (only include used icons in UMD)
- Lazy-load `blu-blocks` and `blu-templates` on first use
- Inline critical CSS from CssBuilder (above-the-fold tokens only)
- Precompile configs at build time where possible (`blu build --precompile`)

### 7.2 Bus Performance

| Metric | Target |
|--------|--------|
| Local command dispatch latency | < 0.5ms |
| Transport round-trip (WebSocket, LAN) | < 50ms |
| Middleware chain (5 middlewares) | < 2ms total |
| Max commands/second (local) | > 10,000 |
| Max concurrent sessions (Kitsy Server) | > 10,000 per node |

### 7.3 Rendering Performance

```typescript
// ViewNode tree diffing: only re-render changed subtrees
// The ViewNode model enables efficient diffing because:
// 1. Each node has a stable `id`
// 2. Props are plain objects (deep-equal comparable)
// 3. Data bindings are resolved separately from the tree

// When a JSON Patch arrives from the server:
// 1. Apply patch to ApplicationConfiguration
// 2. Identify which ViewNodes changed (patch paths → node IDs)
// 3. Re-resolve only affected nodes
// 4. React reconciler handles DOM diff

// This is O(patch) not O(tree) — critical for large apps
```

---

## 8. GAP: Schema Versioning and Migration

### 8.1 The Problem

ApplicationConfiguration will evolve. Stored configs (in Kitsy Server, in user's files, in the template marketplace) must survive schema changes.

### 8.2 Versioning Strategy

```typescript
interface ApplicationConfiguration {
  $schema: "https://blu.kitsy.ai/schema/v1.json";  // Schema URL (doubles as version)
  $version: number;                                   // Monotonic version counter
  
  // ... rest of config
}
```

### 8.3 Migration Chain

```typescript
// Migrations are pure functions: old config → new config
type Migration = (config: unknown) => unknown;

const migrations: Record<number, Migration> = {
  // v1 → v2: Rename "navs" to "navigation"
  2: (config) => ({
    ...config,
    $version: 2,
    navigation: config.navs,
    navs: undefined,
  }),
  
  // v2 → v3: Move theme into config.theme (flatten)
  3: (config) => ({
    ...config,
    $version: 3,
    theme: config.config?.theme,
  }),
};

function migrateConfig(config: unknown): ApplicationConfiguration {
  let current = config;
  const version = current.$version || 1;
  
  for (let v = version + 1; v <= LATEST_VERSION; v++) {
    if (migrations[v]) {
      current = migrations[v](current);
    }
  }
  
  return validateConfig(current); // JSON Schema validation after migration
}
```

### 8.4 Rules for Schema Evolution

1. **New fields are always optional** — never require a field that didn't exist before
2. **Removing a field requires a 2-version deprecation** — v(N): mark deprecated, v(N+1): migration removes it
3. **Renaming = add new + migrate + deprecate old**
4. **The `ext` bag is unversioned** — it's the escape hatch, but it must not be used for core concerns
5. **Every migration is reversible** — store both up() and down() functions for rollback
6. **Configs without `$version` are treated as v1** — backward compatible with existing POC configs

---

## 9. GAP: Plugin Architecture

### 9.1 Plugin Contract

Plugins are the extension mechanism for both free and premium tiers. The existing `ApplicationConfiguration.plugins` field needs a formal contract.

```typescript
interface BluPlugin {
  // Identity
  name: string;                        // "kitsy-analytics", "my-custom-crm"
  version: string;                     // Semver
  
  // Capabilities declared (for security and UI)
  capabilities?: {
    components?: boolean;               // Registers new components
    effects?: boolean;                  // Registers bus effects
    middleware?: boolean;               // Adds bus middleware
    dataSources?: boolean;              // Registers data source adapters
    theme?: boolean;                    // Extends theme tokens
    routes?: boolean;                   // Adds routes
  };
  
  // Lifecycle
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

### 9.2 Plugin Isolation

```
RISK: A plugin can break the entire app by:
  - Registering a middleware that throws
  - Registering a component that crashes on render
  - Dispatching infinite bus commands
  
MITIGATIONS:
  1. Plugin middleware runs in a try-catch wrapper; errors are logged, not propagated
  2. Plugin components render inside error boundaries (Section 4.3)
  3. Plugin bus commands are tagged with $source: "plugin:name" — rate-limitable
  4. In premium mode: Kitsy Marketplace plugins are reviewed and signed
  5. Plugin URNs are namespaced: "urn:plugin:analytics:tracker" (cannot collide with "urn:blu:*")
```

---

## 10. GAP: Testing Strategy

### 10.1 Config Testing (Critical for AI-generated configs)

```typescript
// @kitsy/blu-test — Testing utilities

// Validate a config without rendering
import { validateConfig } from "@kitsy/blu-test";
const result = validateConfig(myConfig);
// { valid: true } or { valid: false, errors: [...] }

// Render a config in a test environment (JSDOM)
import { renderConfig } from "@kitsy/blu-test";
const { getByText, bus, state } = renderConfig(myConfig);

// Simulate bus commands
bus.dispatch({ type: "navigate", target: "/products" });

// Assert state changes
expect(state.get("cart.items")).toHaveLength(3);

// Snapshot the ViewNode tree (not DOM — ViewNodes are deterministic)
expect(resolveViewTree(myConfig)).toMatchSnapshot();
```

### 10.2 Contract Testing for AI Generation

When Kitsy Mind generates a config, it must pass these gates:

```
1. JSON Schema validation     — structural correctness
2. URN resolution             — all componentUrn values exist in registry
3. Data source validation     — all source references exist in dataSources
4. Action validation          — all action targets are valid
5. Circular reference check   — no infinite ViewNode nesting
6. Render smoke test          — renders without errors in headless mode
7. Accessibility baseline     — required labels, alt text, heading hierarchy
```

This is the "AI guardrail" that makes Blu's approach fundamentally more reliable than raw code generation. Every AI-produced config runs through a deterministic validation pipeline before it reaches the user.

---

## 11. GAP: Observability and Debugging

### 11.1 Structured Logging

```typescript
// Every bus command is a structured log event
// The middleware chain already supports this — formalize it

interface BusLogEntry {
  timestamp: number;
  command: {
    type: string;
    target: string;
    meta: Record<string, unknown>;
  };
  source: string;               // $source
  destination: string;          // $destination
  duration: number;             // ms through middleware chain
  middlewares: {
    name: string;
    duration: number;
    modified: boolean;          // Did this middleware alter the command?
  }[];
  effects: {
    name: string;
    triggered: boolean;
    duration?: number;
  }[];
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}
```

### 11.2 Distributed Tracing (Premium)

In premium mode, `$correlationId` links the full journey:

```
Browser A: user clicks "Buy"
  → bus command: order:create [$correlationId: "abc-123"]
  → transport: WebSocket → Kitsy Server
Kitsy Server: receives order:create [$correlationId: "abc-123"]
  → effect: validate order
  → effect: call payment API
  → effect: update inventory
  → bus command: order:confirmed [$correlationId: "abc-123"]
  → transport: WebSocket → Browser A
  → transport: WebSocket → Browser B (admin dashboard)
Browser A: receives order:confirmed
  → navigate to /order/confirmed
Browser B (admin): receives order:confirmed
  → update order list in real-time

// All of this is traceable via $correlationId "abc-123"
// Kitsy dashboard shows the full journey as a timeline
```

---

## 12. RISK: Sustainability Analysis

### 12.1 Technical Sustainability Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **React version coupling** — UMD bundle pins React; React major versions break ecosystem | High | Maintain a React compatibility matrix. Test against React canary builds. The ViewNode abstraction means components can be re-implemented if React diverges. Long-term, the renderer is swappable because of Section 5's boundary. |
| **Bundle size creep** — every new feature adds to the UMD bundle | High | Hard size budget (Section 7.1). CI check that fails build if gzipped size exceeds budget. Lazy-load everything that isn't needed for first render. |
| **Schema ossification** — once external users depend on the config schema, changing it becomes very expensive | High | Invest heavily in getting v1 schema right before public launch. Use the migration chain (Section 8) from day one. JSON Schema validation prevents drift. |
| **Bus bottleneck** — if everything routes through the bus, it becomes a performance chokepoint | Medium | The bus is designed as a thin dispatch layer, not a data store. Heavy payloads should use references (IDs) not inline data. Middleware should be O(1) not O(n). Batch middleware (Section Cross-Cutting) mitigates chatty dispatch patterns. |
| **Single-maintainer risk** — architecture knowledge concentrated in one person | High | The two documents plus this gap-fill serve as institutional knowledge. Ensure the test suite is comprehensive enough that contributors can modify code with confidence. Prioritize documentation of non-obvious decisions (ADRs). |

### 12.2 Business Sustainability Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Open-source without community** — Apache 2.0 code with no contributors is just free labor for others | High | Ship the narrow wedge first (blu-bus standalone). Write excellent docs. Be active on GitHub, Twitter/X, dev communities. Target the Indian developer community first (home advantage). Consider a Discord/community from day one. |
| **Free tier cannibalization** — if the free tier is too good, nobody upgrades | Medium | Free tier is powerful for individuals. Premium value is: multi-user collaboration, server-managed state, AI generation, managed hosting, SLA. These are business needs that individuals don't have but teams and companies do. The gap is structural, not artificial. |
| **Competitor moat via data/network effects** — Webflow has millions of sites; Shopify has merchant lock-in | High | Don't compete on the same axis. Blu competes on developer adoption and AI-readiness. Developer tools win through technical merit, not network effects. The open-source framework is the wedge; the platform comes later. |
| **AI commoditization** — every builder adds AI; Blu's AI story isn't unique | Medium | Blu's AI advantage is structural (schema-driven), not feature-level (chat UI). When competitors' AI generates brittle code, Blu's generates validated schemas. This advantage increases with complexity — simple landing pages are equivalent, but a 20-screen business app is where schema-driven wins. |
| **Kitsy brand vs HEYPKV brand confusion** — two company brands in market | Low | Kitsy is the product brand. HEYPKV Innovations is the legal entity. This is standard (Alphabet/Google, Meta/Facebook). Don't mention HEYPKV in developer-facing materials. |

### 12.3 Risks That Are Hard to Solve

**1. Developer adoption chicken-and-egg:**
Components, templates, and blocks need a library of quality examples to attract users. But building a large component library takes significant effort. And without users, there's no community to contribute components.

*Approach:* Start with a small, extremely polished set (< 20 components). Make them the best-documented, best-designed React components available. Quality over quantity. The Tailwind CSS playbook: small core, excellent docs, passionate early community.

**2. Visual builder quality:**
Kitsy Studio will be compared to Webflow, which has had 10+ years of development. Building a competitive visual editor is a multi-year, multi-million-dollar effort.

*Approach:* Don't build a general-purpose visual editor. Build a **config-aware** editor — one that understands ViewNode semantics. It won't have pixel-perfect free-form layout like Webflow, but it will have something Webflow doesn't: structured understanding of what each component is and does. This is the "less but better" strategy.

**3. Server infrastructure costs at scale:**
Kitsy Server with persistent WebSocket connections, real-time sync, and AI agent compute is expensive to host.

*Approach:* 
- Free tier: no server infrastructure (CDN-only, user self-hosts)
- Starter tier: static site hosting only (S3/R2, cheap)
- Pro tier: managed WebSocket connections (Cloudflare Durable Objects or Fly.io, scale-to-zero)
- Enterprise: dedicated infrastructure, passed to customer
- AI compute: per-request billing, passed through with margin

---

## 13. HARDENING: Software Principles Checklist

### 13.1 SOLID Applied to Blu

| Principle | Application |
|-----------|-------------|
| **S — Single Responsibility** | Each `@kitsy/blu-*` package has ONE concern. Bus doesn't render. Renderer doesn't route. Data doesn't style. |
| **O — Open/Closed** | ComponentRegistry, DataSourceRegistry, plugin system, middleware chain — all open for extension without modifying framework code. |
| **L — Liskov Substitution** | All Transport implementations are substitutable (Local, WebSocket, SSE, BroadcastChannel). All DataSource adapters are substitutable. |
| **I — Interface Segregation** | Developers who only need the bus don't import the renderer. The UMD bundle is the exception (convenience over modularity). |
| **D — Dependency Inversion** | ViewNodes depend on URNs (abstractions), not concrete components. DataBindings depend on DataSource IDs, not concrete adapters. Actions depend on type strings, not implementation functions. |

### 13.2 Additional Principles

| Principle | Application |
|-----------|-------------|
| **Convention over Configuration** | Sensible defaults everywhere. `render(config)` works with minimal config. |
| **Principle of Least Surprise** | Free config works on premium. Premium config works on free (minus server features). Same API everywhere. |
| **Fail Gracefully** | ViewNode with invalid URN renders a placeholder, not a crash. Missing data source shows loading state, not exception. Plugin error is contained, not propagated. |
| **Eat Your Own Cooking** | DevTools is a Blu app. Kitsy Studio is a Blu app. Documentation site should be a Blu app. |
| **Schema-First Development** | Define the contract (types, JSON Schema) before implementing. This is the most important discipline for AI-readiness. |

---

## 14. Revised Phase 0-1 Scope

Based on all gaps filled above, here is the hardened scope for the immediate work:

### Phase 0 (Current → v0.1.0 — "Ship the Wedge")

**Objective:** Rebrand, stabilize, and ship the first thing developers can use.

| Task | Deliverable |
|------|------------|
| Rebrand `@pkvsinha/react-*` → `@kitsy/blu-*` | Published packages on npm under `@kitsy` scope |
| Publish `@kitsy/blu-types` | JSON Schema + TypeScript types for ApplicationConfiguration |
| Rename `window.ReactApp` → `window.Blu` | UMD bundle update |
| Add `$version` to ApplicationConfiguration | Schema versioning from day one |
| Split `blu-shell` into `/core` and `/react` exports | Section 5.3 |
| Write "Getting Started" guide | 3 paths: CDN script tag, npm install, full app |
| Publish `@kitsy/blu-bus` as standalone | Usable without the rest of Blu |
| Add ViewNode parallel path (alongside React.ReactNode) | Config compiler resolves ViewNodes to React elements |
| CI: bundle size budget check | Fail build if > 150KB gzipped (core) |
| CI: JSON Schema validation of example configs | Catch contract regressions |

### Phase 1 (v0.2.0 — "Data + Transport + Actions")

**Objective:** Blu becomes a complete application framework, not just a renderer.

| Task | Deliverable |
|------|------------|
| `@kitsy/blu-data` | Data source registry, adapters (rest, static, bus, state), data binding resolution |
| ViewNode `data`, `repeat`, `when` fields | Section 1.4 |
| ViewNode `actions` field | Section 3.2 |
| Form contract in `@kitsy/blu-blocks` | Section 2.2 |
| `@kitsy/blu-wire` | Transport interface + WebSocket/BroadcastChannel/SSE adapters |
| `@kitsy/blu-devtools` (v1) | Bus inspector + state viewer |
| `@kitsy/blu-validate` | Standalone validation (for server and AI pipeline) |
| `render(config, options)` with RenderOptions | Section 0.3 — the free/premium bridge |
| Migration chain infrastructure | Section 8 |
| Plugin contract formalization | Section 9 |
| `@kitsy/blu-test` | Config testing utilities |
| Performance baselines | Section 7 targets measured and tracked in CI |

### Phase 1 Exit Criteria

A developer can:
1. Load Blu via CDN `<script>` tag and render a multi-page app with data from a REST API
2. `npm install @kitsy/blu-shell` and build the same app with full TypeScript support
3. Add `{ platform: "kitsy" }` to render options and the same app syncs state through Kitsy Server
4. Define forms, actions, conditional rendering, and data-driven lists — all as JSON config
5. Open Blu DevTools and see every bus command, state change, and data fetch in real-time

When these five criteria are met, Phase 1 is done and the framework is ready for Studio (Phase 2) and AI generation (Phase 3).

---

## 15. The AI-Readiness Thesis (Formalized)

The entire architecture ultimately serves one proposition:

> **An AI that generates structured data against a validated schema will always be more reliable than an AI that generates arbitrary code.**

Here is why every architectural decision supports this:

| Decision | AI Benefit |
|----------|-----------|
| ViewNode (UI as data) | AI generates JSON, not JSX. JSON is validatable, diffable, patchable. |
| ComponentRegistry (URN catalog) | AI chooses from a known set of components with typed prop schemas. It can't hallucinate a component that doesn't exist. |
| Actions (transitions as data) | AI wires behavior through typed action declarations, not arbitrary event handlers. |
| DataSource + bindings (state as data) | AI connects components to data through references, not fetch() calls. |
| Form contract | AI generates forms as field declarations with validation rules, not 50 lines of onChange handlers. |
| EventBus (communication as protocol) | AI agents participate via the same bus protocol as everything else. No special integration needed. |
| JSON Schema validation | Every AI-generated config passes through a deterministic validation pipeline before reaching the user. |
| JSON Patch (RFC 6902) | AI edits are patches, not regenerations. Change one section without touching the rest. |
| Migration chain | AI can generate configs targeting the latest schema version. Old configs auto-migrate. |

**The competitive moat is not "we have AI." The moat is "our AI operates on a typed, validated, diffable contract that makes generation reliable and editing safe."**

No other framework in the current landscape — not Lovable, not Bolt, not Builder.io, not Webflow — has this combination of schema discipline and transport-aware runtime. That is the bet, and these documents (foundation + roadmap + this gap-fill) formalize it completely.

---

## 16. Consolidated Package Map (Post Gap-Fill)

```
OPEN SOURCE (Apache 2.0) — "Blu"
───────────────────────────────────
@kitsy/blu-bus          EventBus, Effects, Channels, Commands
@kitsy/blu-wire         Transport interface + adapters
@kitsy/blu-data         Data source registry, adapters, binding resolution
@kitsy/blu-shell        App orchestration (core/ + react/ exports)
@kitsy/blu-core         Base primitives (Box, Text, Container)
@kitsy/blu-ui           Component library
@kitsy/blu-blocks       Widgets + Forms
@kitsy/blu-route        Navigation
@kitsy/blu-style        Theme, tokens, CssBuilder
@kitsy/blu-context      React hooks, AppContext
@kitsy/blu-grid         Layout
@kitsy/blu-icons        Icons
@kitsy/blu-templates    Pre-built templates
@kitsy/blu-types        TypeScript types + JSON Schema
@kitsy/blu-validate     Config validation (standalone, for AI pipeline)
@kitsy/blu-test         Testing utilities
@kitsy/blu-devtools     Bus inspector, state viewer, config explorer
@kitsy/blu-sync         Client-side sync protocol
@kitsy/create-blu       Project scaffolder CLI
@kitsy/blu-cli          Dev tooling CLI

PROPRIETARY / BSL — "Kitsy Platform"
───────────────────────────────────
@kitsy/server           Kitsy Server (Node.js, BSL)
@kitsy/protocol         Shared wire types (BSL)
@kitsy/studio           Visual builder (Proprietary)
@kitsy/canvas           ViewNode editor model (Proprietary)
@kitsy/mind             AI agent framework (Proprietary)
@kitsy/prompts          Prompt templates, schema instructions (Proprietary)
```

Total: 20 open-source packages + 6 proprietary packages.

---

## 17. Final Architecture Diagram (Complete)

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
     ═══════════ BLU BUS (transport layer: @kitsy/blu-wire) ═════════
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
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│   │ CDN / UMD      │  │ npm / ESM      │  │ kitsy.ai managed   │   │
│   │ (script tag)   │  │ (build tool)   │  │ (platform)         │   │
│   │ FREE           │  │ FREE           │  │ PREMIUM            │   │
│   └────────────────┘  └────────────────┘  └────────────────────┘   │
│                                                                      │
│   render(config)       render(config)       render(config, {         │
│                                               platform: "kitsy"      │
│                                             })                       │
│                                                                      │
│   SAME CONTRACT. SAME API. SEAMLESS UPGRADE.                         │
└──────────────────────────────────────────────────────────────────────┘
```
