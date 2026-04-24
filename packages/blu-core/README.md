# @kitsy/blu-core

Layer 1 — Primitives.

This package defines the shared vocabulary every other Blu package speaks: the `BluEvent` envelope, the six event classes, the four durability tiers, the five origin types, the six authority declarations, and the projection contract.

`@kitsy/blu-core` has zero runtime dependencies. It is pure TypeScript that compiles to ESM and ships with type declarations. Everything in this package can run in the browser, in Node, in a service worker, or inside a build script.

For the spec these types implement, see `docs/blu/specification.md` §1–§6.

## Install

```bash
pnpm add @kitsy/blu-core
```

## What is here

- `BluEvent`, `PartialEvent` — the canonical event envelope and the partial form the bus accepts on emit
- `EventClass`, `Durability`, `Origin`, `Authority` — the four enumerations that classify every event
- `Projection`, `ProjectionHandle` — the read-model contract
- `createEventId()` — ULID generator, sortable by emission time
- `applyEnvelopeDefaults()` — completes a `PartialEvent` into a `BluEvent` (used by `@kitsy/blu-bus`)
- `propagateCausality()` — preserves `correlationId` and assigns `causationId` for derived events

## Versioning

Pre-1.0 releases ship as `1.0.0-dev.N`. The first stable release is `1.0.0`. Every published version maintains backward-compatible types within a major.
