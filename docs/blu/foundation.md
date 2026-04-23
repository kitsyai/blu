# Blu — Foundation

**Status:** Canonical
**Scope:** What Blu is, why it exists, and the principles that govern every decision downstream.

---

## 1. What Blu is

Blu is a schema-driven UI framework with an event-sourced runtime.

Two sentences, because both are load-bearing:

- **Schema-driven**: applications are described as data — views, bindings, data sources, forms, actions — not as imperative component trees. A schema describes what the app is; the runtime renders and animates it.
- **Event-sourced**: every change to the application's dynamic state is an event appended to a journal. Everything a component reads is a projection derived from that journal. Nothing is mutated in place.

The combination is the point. Schema-driven UI without an event-sourced runtime ends up with implicit mutation hiding behind declarative bindings, and debuggability suffers. Event-sourced runtimes without a schema-driven surface end up demanding that every application author write reducers, and adoption suffers. Blu commits to both because neither is sufficient alone.

---

## 2. Why Blu exists

Three problems that existing tools solve partially and none solve together.

**The state-first problem.** Most UI frameworks push developers into a global-store mindset before the application needs one. Redux, MobX, Zustand, Pinia — all useful, all biased toward centralizing state early. The cost is boilerplate, premature abstraction, and a mental split between "view code" and "store code" that AI code generators and junior developers both struggle to navigate cleanly.

**The sync-as-afterthought problem.** Cross-tab synchronization, optimistic updates, offline queues, replay, and remote hydration are treated as add-ons in most architectures. They get bolted onto a runtime that was never designed to accommodate them, which is why they are almost always buggy and why every team that needs them ends up rebuilding the same infrastructure.

**The AI-authoring problem.** LLMs generate better code when there is one coherent model to reason about. Applications built on five independent concerns — components, state, actions, effects, routing — force generators to juggle conventions across unrelated subsystems. A single event/projection model, declared once, is dramatically easier for an AI (or a human) to reason about at scale.

Blu is designed to make the productive middle — local development with good DX — feel like working in React with local `useState`, while making the hard parts — durability, causality, sync, replay — emerge naturally from the same model rather than being retrofitted later.

---

## 3. The one-sentence positioning

> **Blu is an event-first, schema-driven UI framework where state is a projection of an append-only journal, and sync is a transport over that journal.**

Everything that follows in the architecture and specification documents is consequence of this sentence.

---

## 4. Principles

These are not preferences. They are the decisions that have been made, and any future decision that conflicts with one of them loses.

### 4.1 Events are primary

The unit of change in Blu is an event. Views emit events. Projections consume events. The bus transports events. The slate journals events. There is no other primitive for "something happened."

### 4.2 State is derived

Applications do not "have" state. They have projections — named, typed read-models computed from the journal. A component that reads `cart.totals` is reading the output of a projection function over cart events. There is no mutable `cart.totals` object that someone writes to.

### 4.3 Authority is declarative

Every projection declares where its truth lives: local to the session, durable in the browser, authoritative on the server, or derived from other projections. Authority is never implicit. A field cannot silently drift between "I think this lives in memory" and "I think this lives on the server" — the declaration is the contract.

### 4.4 Durability is tiered

Not every event deserves storage. Events declare a durability tier — ephemeral, observable, journaled, or replicated — and the runtime respects it. This keeps the journal small, the sync protocol narrow, and the devtools readable.

### 4.5 Causality is preserved

Every event carries its causal parent and a correlation identifier for the transaction that spawned it. A chain of events triggered by a single user action is traceable end-to-end. This is not optional metadata; it is how debugging, replay, and AI introspection work.

### 4.6 The author writes declarations

The default authoring surface is a schema. Views are data. Bindings are data. Actions are data. Most authors of Blu applications never write an event emission by hand, because the runtime emits events on their behalf when they declare an action on a view.

### 4.7 The runtime is honest

When authors do drop into code, they see the real model. There is no facade pretending to be mutable state. Hooks emit events and read projections. The gap between the declarative surface and the runtime is kept narrow so that moving from one to the other is continuous, not a context switch.

### 4.8 Progressive capability, not progressive adoption

An application written on Blu is fully event-sourced from line one. What scales with the application's needs is the *capability* expressed through that model: a feature might start ephemeral, graduate to journaled, and later become replicated across devices. The framework does not have an "opt-in" event mode that authors toggle — it has a single model that grows in expressiveness as the application does.

### 4.9 Sync is transport

Cross-tab, cross-device, and client-server synchronization are transports that move events between slates. They are not separate architectures. The same event that mutates local state can be replicated over a BroadcastChannel, a WebSocket, or a background sync — the model doesn't care, and the author declares the intent once.

### 4.10 Tooling is infrastructure, not a product

A causal-graph devtool, a projection inspector, and a journal replay viewer are part of the framework, not features layered on top. An event-sourced system without these tools is undebuggable in practice. Blu ships with them or it does not ship.

---

## 5. What Blu is not

It matters to say this plainly, because each of these comparisons is one developers will reach for.

**Blu is not a state-management library.** Redux, Zustand, Jotai, and MobX manage state. Blu does not manage state — it derives state from a journal. The journal is the product; the state is a consequence.

**Blu is not an event bus.** Event buses route messages between listeners. Blu's bus does this, but the bus is only one half of the backbone. The slate — durability, projection, authority, causality — is the other half, and it is the part that distinguishes Blu from every pub/sub library.

**Blu is not CQRS for the enterprise.** The read/write separation is borrowed, but Blu is a UI framework. It is optimized for the ergonomics of an application developer and the pragmatics of a schema author, not for the formalism of a domain-driven backend.

**Blu is not event sourcing as classically defined.** Events are not all durable by default. Projections are disposable and rebuildable. The model is event-sourced in shape but UI-friendly in posture.

**Blu is not a local-first framework, though it is compatible with local-first.** Blu does not mandate CRDTs, does not require offline-first, and does not assume any particular merge strategy. It provides the journal and the transport; applications that want local-first semantics build on those primitives.

**Blu is not a React library.** Blu's bindings are React-native for the current runtime, but the core model — events, projections, authority, durability — is framework-agnostic. A future binding to another UI library is a question of integration, not redesign.

---

## 6. What "version zero" means

Blu is new. There is no deployed application consuming `@kitsy/blu` contracts in a way that constrains design. The single published artifact with that name is a placeholder that can be reshaped freely.

Version zero means three things:

1. **No compatibility debt.** Decisions are made on merits, not on preservation.
2. **One coherent model, shipped whole.** The framework does not ship in halves where the "real" model arrives in a later release. The event-sourced runtime is present from the first tagged version.
3. **No facades.** There is no parallel "familiar" API that hides the model. Authors learn Blu once.

This document and the architecture, specification, and execution documents that follow are written as if nothing existed before them. They supersede every earlier plan, proposal, or master document in this repository.

---

## 7. Related documents

- `docs/blu/architecture.md` — the canonical architecture: layering, primitives, package map.
- `docs/blu/specification.md` — precise contracts for events, projections, authority, views, actions, forms, data, transport.
- `docs/blu/shell.md` — shell taxonomy and composition rules.
- `docs/blu/execution.md` — phase one sprints.
- `docs/governance.md` — cross-track governance, doc hierarchy, decision authority, scope control.
