import { createThemeBuilder } from "@kitsy/blu-style";
import { basePlugin } from "@kitsy/blu-core";
import { layoutPlugin } from "@kitsy/blu-grid";
import { componentsPlugin } from "@kitsy/blu-ui";
import { widgetsPlugin } from "@kitsy/blu-blocks";

// Default theme (blu.shell.*)
// const app = createThemeBuilder().use(basePlugin()).use(layoutPlugin()).use(componentsPlugin()).use(widgetsPlugin());
const app = createThemeBuilder();
// Material preset
const material = createThemeBuilder({
  tokens: {
    "color-primary-500": "#6750A4",
    "radius-md": "12px",
  },
})
  .use(basePlugin())
  .use(layoutPlugin())
  .use(componentsPlugin())
  .use(widgetsPlugin());

// Ant-like preset
const ant = createThemeBuilder({
  tokens: {
    "color-primary-500": "#1677ff",
    "radius-md": "6px",
  },
})
  .use(basePlugin())
  .use(layoutPlugin())
  .use(componentsPlugin())
  .use(widgetsPlugin());

export { app, ant };
