const frameworkBrandName = "blu";

export const frameworkBrand = Object.freeze({
  scope: "@kitsy",
  name: frameworkBrandName,
  displayName: "Blu",
  placeholder: true,
  placeholderReason: "Temporary framework name until legal clearance is complete.",
});

export const frameworkPackages = Object.freeze({
  shell: "@kitsy/blu-shell",
  core: "@kitsy/blu-core",
  ui: "@kitsy/blu-ui",
  context: "@kitsy/blu-context",
  icons: "@kitsy/blu-icons",
  bus: "@kitsy/blu-bus",
  grid: "@kitsy/blu-grid",
  route: "@kitsy/blu-route",
  style: "@kitsy/blu-style",
  blocks: "@kitsy/blu-blocks",
  templates: "@kitsy/blu-templates",
});

export const frameworkBundles = Object.freeze({
  standalone: `${frameworkBrandName}.standalone.min.js`,
  lean: `${frameworkBrandName}.lean.min.js`,
  globalName: "Blu",
});

export const frameworkCss = Object.freeze({
  shell: `${frameworkBrandName}.shell.css`,
  shellMin: `${frameworkBrandName}.shell.min.css`,
  material: `${frameworkBrandName}.material.css`,
  materialMin: `${frameworkBrandName}.material.min.css`,
  materialLegacy: `${frameworkBrandName}.material.legacy.css`,
  materialLegacyMin: `${frameworkBrandName}.material.legacy.min.css`,
  ant: `${frameworkBrandName}.ant.css`,
  antMin: `${frameworkBrandName}.ant.min.css`,
  core: `${frameworkBrandName}.core.css`,
  coreMin: `${frameworkBrandName}.core.min.css`,
  ui: `${frameworkBrandName}.ui.css`,
  uiMin: `${frameworkBrandName}.ui.min.css`,
  grid: `${frameworkBrandName}.grid.css`,
  gridMin: `${frameworkBrandName}.grid.min.css`,
  blocks: `${frameworkBrandName}.blocks.css`,
  blocksMin: `${frameworkBrandName}.blocks.min.css`,
  style: `${frameworkBrandName}.style.css`,
  styleMin: `${frameworkBrandName}.style.min.css`,
  styleLegacy: `${frameworkBrandName}.style.legacy.css`,
  styleLegacyMin: `${frameworkBrandName}.style.legacy.min.css`,
});
