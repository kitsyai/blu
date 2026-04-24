# @kitsy/blu-core changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Sprint 1 scaffold: `BluEvent` envelope, `EventClass`, `Durability`, `Origin`, `Authority` enumerations.
- `Projection` and `ProjectionHandle` contracts.
- `createEventId()` ULID generator (Crockford base32, 48-bit timestamp + 80-bit randomness, sortable).
- `applyEnvelopeDefaults()` and `propagateCausality()` helpers.
- Vitest suite for envelope construction, ULID monotonicity, and causality preservation.
