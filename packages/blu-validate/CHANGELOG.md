# @kitsy/blu-validate changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Sprint 1 scaffold: `Result<T>` and `ValidationError` shapes.
- `validateEvent` and `validatePartialEvent` for envelope validation.
- `validateApplicationConfiguration` (full traversal: routes, data sources, projections, theme, event registry, entry view).
- `validateViewNode` recursive traversal with action and binding validation.
- `validateAction` discriminating across all four action variants.
- `validateDataSource` discriminating across all five data source variants.
- `validateFormDefinition` and `validateComponentMeta`.
- Vitest suite covering the happy path and a representative set of failures for each validator.
