# Blu — Architecture

**Status:** Canonical
**Scope:** The layered architecture, the core primitives, the flow of data, and the package map.

Read `foundation.md` first. This document assumes the principles there are accepted and goes on to describe how the framework is built.

---

## 1. Layered architecture

Blu is organized in four layers. Each layer has a single responsibility, and each consumes only the layer beneath it.

```
┌─────────────────────────────────────────────────────────┐
│ View layer                                              │
│   blu-core, blu-ui, blu-icons, blu-grid,                │
│   blu-templates, blu-style, blu-blocks                  │
│                                                         │
│ — Components, layouts, icons, styling, templates.       │
│   All views are pure functions of projections.          │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│ Integration layer                                       │
│   blu-route, blu-context, blu-shell                     │
│                                                         │
│ — Glue between view and backbone. Routing, context      │
│   providers, shell composition. Shell straddles.        │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│ Backbone                                                │
│   blu-bus          ◄────────►   blu-slate               │
│   (transport)                   (memory + projection)   │
│                                                         │
│ — The nervous system. Events flow through the bus;      │
│   truth lives in the slate. Complementary, not stacked. │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│ Primitives                                              │
│   blu-core (BluEvent, Projection, Authority, types)     │
│   blu-wire (transport adapters)                         │
│                                                         │
│ — The model. Every other package is a consumer of       │
│   these primitives.                                     │
└─────────────────────────────────────────────────────────┘
```

The backbone is drawn as two complementary halves rather than a stack. This matters. The bus is not "on top of" the slate, and the slate is not "on top of" the bus. They are two organs of the same nervous system, and either can be used without the other for narrow purposes — but together they are the backbone on which every Blu application runs.

---

## 2. The primitives

Four primitives, defined in `blu-core`, are the vocabulary of the entire framework.

### 2.1 BluEvent

An event is a structured, immutable record of something that happened or was requested. Every event carries a type, a payload, and an envelope of metadata describing its class, durability, causality, and origin. Events are the only unit of change in the system. No mutable command, no imperative setter, no side-channel. Events.

Event classes are drawn from a fixed set: `intent` (someone requested this), `fact` (this actually happened), `system` (the runtime itself emitted this), `projection` (a projection was recomputed), `sync` (the transport did something), and `devtools` (the tooling emitted this).

### 2.2 Projection

A projection is a named function that consumes events and produces a read-model. Projections are pure, deterministic, and disposable — any projection can be thrown away and recomputed from the journal. The runtime maintains the computed output, memoizes it, and surfaces it to views through hooks or binding expressions.

Projections are the answer to "where is the state?" The answer is "there is no state; there are projections."

### 2.3 Authority

Authority is a declaration attached to a projection describing where its truth lives. The set is fixed: `local-only`, `local-authoritative`, `projection-authoritative`, `browser-authoritative`, `server-authoritative`, `derived-only`. A projection declares its authority at registration time, and the runtime enforces it — a `server-authoritative` projection cannot be mutated locally without going through a sync round-trip, for example.

Authority is the answer to "who owns this data?" It is never implicit.

### 2.4 Durability

Durability is a tier attached to each event describing how long the event must live and how far it must travel. The set is fixed: `ephemeral` (discarded after dispatch), `observable` (kept in memory for devtools and current-session replay), `journaled` (persisted locally), `replicated` (persisted and propagated to other slates via transport).

Durability is the answer to "does this event matter for long?" It is declared per-event, not per-type, so the same event type can be ephemeral in one context and journaled in another.

---

## 3. Flow of data

Three flows, each drawn explicitly.

### 3.1 Write path

```
User interaction
    ↓
View declares action (schema) or emits event (code)
    ↓
blu-bus routes event through middleware
    ↓
blu-slate appends event to journal (if durability ≥ observable)
    ↓
Projections relevant to the event recompute
    ↓
Subscribing views re-render
```

Every write follows this path. A schema-declared action compiles to an emit; the emit routes through the bus; the bus hands the event to the slate; the slate updates projections; views re-render. There is no shortcut from a view to a projection that bypasses the journal. This is non-negotiable — the uniformity is what makes replay, devtools, and sync work.

### 3.2 Read path

```
View declares binding (schema) or calls useProjection (code)
    ↓
blu-slate returns memoized projection output
    ↓
Projection subscription registered
    ↓
On next relevant event, projection recomputes, view notified
```

Views never read the journal directly. Views read projections. This is how read performance scales — projections are memoized, incremental where possible, and only recomputed when an event that affects them is appended.

### 3.3 Sync path

```
Local slate appends journaled-or-replicated event
    ↓
If event is replicated:
    blu-wire transport picks up event
    ↓
    Event delivered to peer slate (tab, device, server)
    ↓
    Peer slate appends event, respecting causality and idempotency
    ↓
    Peer projections recompute
```

Sync is the same write path, extended across a transport boundary. An event that is merely journaled stays local. An event that is replicated is offered to whatever transports are registered, and each transport decides whether to deliver it based on destination, auth, and routing metadata.

---

## 4. The backbone — bus and slate

The backbone is two packages, each with a focused responsibility. They are specified precisely in `specification.md`; this section describes their relationship.

### 4.1 blu-bus

The bus is the transport fabric for events within a single process. It receives emissions, applies middleware (logging, validation, auth, devtools taps), and delivers events to their subscribers — chiefly the slate, but also any other registered consumer.

The bus does not remember. It does not persist. It does not project. It is a routing fabric, nothing more.

The bus exposes:

- A subscription API for consumers that want to observe events.
- A middleware chain for cross-cutting concerns.
- A routing model based on event type, namespace, and metadata (destination, correlation, session).

### 4.2 blu-slate

The slate is the memory of the application. It appends events to a journal, maintains projections derived from that journal, enforces authority declarations, and is the authoritative source for every read the view layer performs.

The slate exposes:

- An append API, though in normal operation events reach the slate via the bus.
- A projection registry for declaring and querying read-models.
- A snapshot and compaction API for keeping the journal bounded.
- A subscription API for projection changes.

The slate does not transport. It does not know about tabs, devices, or servers.

### 4.3 Why two packages

The temptation to merge them — one "state + events" primitive — is strong and wrong. Two packages because:

- Transport and memory scale independently. A test harness might use the bus with a stub slate. A headless data worker might use the slate with no bus at all.
- Middleware belongs to the bus. Projections belong to the slate. Mixing them in one package invites cross-concern leakage that is hard to undo later.
- The bus can be replaced (different transport implementations, different middleware policies) without touching the slate's guarantees. The slate can evolve its journal format without breaking the bus contract.

The pairing is intentional and non-negotiable. Every Blu application uses both.

---

## 5. The view layer

Six packages, each with a single responsibility.

### 5.1 blu-core

The core view package holds the primitive view constructs: `ViewNode` (the renderable tree data structure), `ComponentRegistry` (the URN-addressed map from identifiers to React components), and the base `View` component that interprets a ViewNode. Core has no opinions on styling, no component library of its own, no routing. It is the smallest possible thing that can render a schema.

### 5.2 blu-ui

The UI component library: buttons, inputs, cards, typography, modals, menus, tabs, tooltips. Each component is registered with a URN (`urn:blu:ui:button`) and ships with a `ComponentMeta` descriptor for the studio and the Mind generator.

### 5.3 blu-icons

An icon system registered as URNs (`urn:blu:icon:chevron-right`). Icons are components like any other but have an optimized meta shape for the studio palette.

### 5.4 blu-grid

Layout primitives: stack, row, column, grid, spacer, divider. Separate from `blu-ui` because layout is the bones of a page and components are the flesh — mixing them creates coupling that makes both harder to evolve.

### 5.5 blu-templates

Pre-composed view fragments: hero sections, feature grids, footer layouts, pricing tables. Templates are ViewNodes themselves, shipped as data, instantiated by applications that want an opinionated starting point.

### 5.6 blu-style

The styling system. ITCSS cascade, design tokens, CSS-variable theming, the `CssBuilder` utility. Style is consumed by every other view package but owned by none of them.

### 5.7 blu-blocks

Composed blocks that stitch UI, grid, templates, and icons into larger coherent units (forms, wizards, dashboards). Blocks are where view composition becomes application-shaped.

---

## 6. The integration layer

Three packages that bridge view and backbone.

### 6.1 blu-route

Routing is a projection. The current route is derived from a sequence of navigation events. `blu-route` declares the routing projection, provides the `<Router>` boundary, and exposes navigation as an event emission (`router/navigated`) rather than as an imperative call. History, deep links, and cross-tab route sync all fall out of this model without special cases.

### 6.2 blu-context

React context providers that make the backbone accessible to views: the slate provider, the bus provider, the theme provider. `blu-context` is intentionally thin — it holds the wiring, not the logic. Applications mount one `<BluProvider>` near the root and everything downstream can read projections and emit events.

### 6.3 blu-shell

Shell is the dual-life package. It is a view component — it renders chrome, navigation, overlays — and it is an integration layer — it composes the route, the theme, the presenter stack, and the primary content area. Shell consumes from the backbone and the view layer and exposes a composition contract for applications.

Shell is specified in detail in `shell.md`.

---

## 7. Transport and supporting packages

### 7.1 blu-wire

Transport adapters that carry replicated events across process boundaries: `BroadcastChannelTransport` (cross-tab), `WebSocketTransport` (real-time), `SSETransport` (server push), `HTTPTransport` (polling or long-poll), `LocalTransport` (in-process, for tests). A transport is a plugin that registers with the slate and opts into carrying events matching a filter.

### 7.2 blu-schema

Type definitions for the schema languages Blu understands: `ApplicationConfiguration`, `ViewNode`, `DataSource`, `FormField`, `Action`, and the event registry types. Every other package imports from `blu-schema` for shared types. There is no cycle because `blu-schema` contains only types, no runtime.

### 7.3 blu-devtools

The tooling package. Journal timeline, causal graph visualization, projection inspector, authority map, transport monitor, event registry browser. Devtools register with the slate and the bus via their subscription APIs; they emit no events of their own except `devtools`-class events for their own operations.

### 7.4 blu-cli

A command-line tool for scaffolding applications, registering components, inspecting the journal, replaying events, and generating types. The CLI is a thin wrapper over `blu-schema` and `blu-devtools`.

---

## 8. Package map

A complete list of packages with their scope. Precise APIs are in `specification.md`.

| Package           | Layer        | Scope                                                           |
|-------------------|--------------|-----------------------------------------------------------------|
| `@kitsy/blu-core` | Primitives   | BluEvent, Projection, Authority, Durability, base types         |
| `@kitsy/blu-bus`  | Backbone     | Event transport fabric within a process, middleware             |
| `@kitsy/blu-slate`| Backbone     | Journal, projections, snapshots, authority enforcement          |
| `@kitsy/blu-wire` | Primitives   | Transport adapters for replicated events                        |
| `@kitsy/blu-schema` | Primitives | Schema types: ApplicationConfiguration, ViewNode, DataSource…  |
| `@kitsy/blu-validate` | Primitives | Runtime validation for envelopes, configurations, and form data |
| `@kitsy/blu-route`| Integration  | Routing projection, Router component, navigation events        |
| `@kitsy/blu-context` | Integration | React providers for the backbone                              |
| `@kitsy/blu-shell`| Integration  | Shell composition: primary/presenter/overlay                    |
| `@kitsy/blu-view` | View         | ViewNode renderer, ComponentRegistry, core `<View>` component   |
| `@kitsy/blu-ui`   | View         | UI component library (buttons, inputs, cards, typography)       |
| `@kitsy/blu-icons`| View         | Icon set as URN-registered components                           |
| `@kitsy/blu-grid` | View         | Layout primitives                                               |
| `@kitsy/blu-style`| View         | ITCSS cascade, tokens, CssBuilder                               |
| `@kitsy/blu-templates` | View    | Pre-composed ViewNode templates                                 |
| `@kitsy/blu-blocks` | View       | Composed blocks (forms, wizards, dashboards)                    |
| `@kitsy/blu-devtools` | Tooling  | Journal timeline, causal graph, projection inspector            |
| `@kitsy/blu-cli`  | Tooling      | CLI for scaffolding, registration, replay, type generation      |
| `@kitsy/blu`      | Meta         | Convenience re-export that stitches the common set for apps    |

Note on naming: the `@kitsy/blu-view` package holds what was previously sometimes called `blu-core`. The new naming separates primitive-level concerns (`blu-core`, which holds event and projection types) from view-level concerns (`blu-view`, which holds the renderer). This is a one-time correction that happens now because there is no shipped artifact to preserve.

The meta package `@kitsy/blu` re-exports the common set — core, bus, slate, view, context, route, ui, icons, grid, style — so that application authors can install one dependency and get a working framework. Power users install the packages individually.

---

## 9. How Blu fits in the Kitsy platform

Blu is the UI framework. The Kitsy platform is a larger system of modules (Coop, CRM, Finance, HRM) that coordinate via a cross-module event bus, share an AI workforce (Crew), and ship as a single SaaS product (kitsy.ai).

The relationship is precise:

- Blu's `blu-bus` is the in-process event fabric for a single Blu application. It is **not** the Kitsy platform's cross-module bus. When a Blu application is running inside the Kitsy platform, it subscribes to a bridge that forwards selected events between the two. This keeps Blu usable as a standalone framework without mandating the Kitsy platform runtime.
- Blu's `blu-slate` is per-application. The Kitsy platform has its own durability concerns (tenant data, module state) that live in its own layer. The platform may hydrate a Blu application's slate from its own stores, but the two are separately owned.
- Module manifests — the declarations that make a module installable in the Kitsy platform — are defined at the platform level, not in Blu. A Blu application can be packaged as a Kitsy module, but the reverse does not hold: Kitsy modules are not all Blu applications.

The Kitsy platform architecture is documented separately in `docs/reference/kitsy-platform-architecture.md`. This framework document scopes only to Blu.

---

## 10. Related documents

- `docs/blu/foundation.md` — principles that govern this architecture.
- `docs/blu/specification.md` — precise contracts for each primitive and package.
- `docs/blu/shell.md` — shell taxonomy.
- `docs/blu/execution.md` — how the architecture is built in phase one.
- `docs/governance.md` — cross-track process.
