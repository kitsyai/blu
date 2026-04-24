# @kitsy/blu-validate

Layer 1 — Runtime validation.

This package provides pure validation functions for the Blu primitives and the schema vocabulary. The bus uses it as middleware for envelope validation. The runtime uses it to validate `ApplicationConfiguration` at load time. Authoring tools use it to surface issues in real time.

`@kitsy/blu-validate` depends only on `@kitsy/blu-core` and `@kitsy/blu-schema`. It has no other runtime dependencies.

For the contracts validated here, see `docs/blu/specification.md` §1, §10–§15.

## Install

```bash
pnpm add @kitsy/blu-validate
```

## What is here

- `validateEvent(event)` — validates a `BluEvent` envelope (after defaults applied)
- `validatePartialEvent(partial)` — validates a `PartialEvent` before envelope completion
- `validateApplicationConfiguration(config)` — validates an `ApplicationConfiguration` tree
- `validateViewNode(node)` — validates a `ViewNode` subtree
- `validateAction(action)` — validates a single `Action`
- `validateDataSource(source)` — validates a `DataSource` registration
- `validateFormDefinition(form)` — validates a `FormDefinition`
- `validateComponentMeta(meta)` — validates a `ComponentMeta` registration

Every validator returns a `Result<T>`:

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

interface ValidationError {
  path: string;       // Dotted path into the input where the error was found
  code: string;       // Machine-readable code, e.g. "envelope.missing.eventId"
  message: string;    // Human-readable explanation
}
```

The validators do not throw on bad input — they always return a `Result`. Throwing is reserved for genuine programming errors (e.g. calling a validator with an undefined input that should have been guarded upstream).
