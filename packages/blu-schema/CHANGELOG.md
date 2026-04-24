# @kitsy/blu-schema changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Sprint 1 scaffold: `ApplicationConfiguration`, `ViewNode`, `Binding`, `Condition`, `RepeatDirective`.
- Action variants: `NavigateAction`, `EmitAction`, `FormAction`, `CompositeAction`.
- Form vocabulary: `FormDefinition`, `FormField`, `ValidationRule`, `FieldValidation`.
- Data source variants: `RestDataSource`, `GraphQLDataSource`, `StaticDataSource`, `BusDataSource`, `ProjectionDataSource`.
- Component registry: `ComponentMeta`, `PropSchema`, `EventSchema`, `SlotSchema`.
- Routing and theming: `RouteTable`, `RouteEntry`, `ThemeConfiguration`.
- Projection and event type registrations: `ProjectionRegistration`, `EventRegistration`.
- Type-shape vitest assertions to guard the public surface.
