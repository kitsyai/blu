// Branding map for the Blu monorepo.
// Single source of truth for package names, bundle filenames, and CSS asset names.
// Update when new packages are added per docs/blu/architecture.md.

const frameworkBrandName = "blu";

export const frameworkBrand = Object.freeze({
  scope: "@kitsy",
  name: frameworkBrandName,
  displayName: "Blu",
  placeholder: true,
  placeholderReason: "Temporary framework name until legal clearance is complete.",
});

// Layered package map per docs/blu/architecture.md.
// Layer 1 — Primitives
//   blu-core, blu-schema, blu-validate
// Layer 2 — Backbone
//   blu-bus, blu-slate, blu-wire
// Layer 3 — Integration
//   blu-route, blu-context
// Layer 4 — View
//   blu-shell, blu-view, blu-ui, blu-icons, blu-grid, blu-style
// Layer 5 — Authoring
//   blu-templates, blu-blocks
// Layer 6 — Tooling
//   blu-devtools, blu-cli
// Meta umbrella
//   blu (re-exports the curated public surface)
export const frameworkPackages = Object.freeze({
  // Meta
  meta: "@kitsy/blu",

  // Layer 1 — Primitives
  core: "@kitsy/blu-core",
  schema: "@kitsy/blu-schema",
  validate: "@kitsy/blu-validate",

  // Layer 2 — Backbone
  bus: "@kitsy/blu-bus",
  slate: "@kitsy/blu-slate",
  wire: "@kitsy/blu-wire",

  // Layer 3 — Integration
  route: "@kitsy/blu-route",
  context: "@kitsy/blu-context",

  // Layer 4 — View
  shell: "@kitsy/blu-shell",
  view: "@kitsy/blu-view",
  ui: "@kitsy/blu-ui",
  icons: "@kitsy/blu-icons",
  grid: "@kitsy/blu-grid",
  style: "@kitsy/blu-style",

  // Layer 5 — Authoring
  templates: "@kitsy/blu-templates",
  blocks: "@kitsy/blu-blocks",

  // Layer 6 — Tooling
  devtools: "@kitsy/blu-devtools",
  cli: "@kitsy/blu-cli",
});

export const frameworkBundles = Object.freeze({
  standalone: `${frameworkBrandName}.standalone.min.js`,
  lean: `${frameworkBrandName}.lean.min.js`,
  globalName: "Blu",
});

export const frameworkCss = Object.freeze({
  shell: `${frameworkBrandName}.shell.css`,
  shellMin: `${frameworkBrandName}.shell.min.css`,
  ui: `${frameworkBrandName}.ui.css`,
  uiMin: `${frameworkBrandName}.ui.min.css`,
  grid: `${frameworkBrandName}.grid.css`,
  gridMin: `${frameworkBrandName}.grid.min.css`,
  style: `${frameworkBrandName}.style.css`,
  styleMin: `${frameworkBrandName}.style.min.css`,
  blocks: `${frameworkBrandName}.blocks.css`,
  blocksMin: `${frameworkBrandName}.blocks.min.css`,
});
