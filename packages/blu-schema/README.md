# @kitsy/blu-schema

Layer 1 — Schema vocabulary.

This package is the shared TypeScript vocabulary every declarative surface in Blu speaks. It defines the shape of an `ApplicationConfiguration`, the `ViewNode` tree, declarative `Action`s and `Condition`s, `DataSource` registrations, `FormDefinition`s, and `ComponentMeta` for the component registry.

`@kitsy/blu-schema` is **types-only**. It contains no runtime logic — only `interface` and `type` declarations. The companion package `@kitsy/blu-validate` provides runtime validation against these shapes.

For the spec these types implement, see `docs/blu/specification.md` §10–§15.

## Install

```bash
pnpm add @kitsy/blu-schema
```

## What is here

- `ApplicationConfiguration` — root contract for a Blu app
- `ViewNode`, `PropValue`, `Binding`, `RepeatDirective`, `Condition`, `Value` — the view tree
- `Action` and its variants (`NavigateAction`, `EmitAction`, `FormAction`, `CompositeAction`)
- `FormDefinition`, `FormField`, `ValidationRule`, `FieldValidation`
- `DataSource` and its variants (`RestDataSource`, `GraphQLDataSource`, `StaticDataSource`, `BusDataSource`, `ProjectionDataSource`)
- `ComponentMeta`, `PropSchema`, `EventSchema`, `SlotSchema`
- `RouteTable`, `RouteEntry`, `ThemeConfiguration`
- `ProjectionRegistration`, `EventRegistration`

## Versioning

Pre-1.0 releases ship as `1.0.0-dev.N`. Breaking schema changes bump the major version of the package after 1.0.
