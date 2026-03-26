import { createThemeBuilder } from "@kitsy/blu-style";
import { basePlugin } from "@kitsy/blu-core";
import { layoutPlugin } from "@kitsy/blu-grid";
import { componentsPlugin } from "@kitsy/blu-ui";

const builder = createThemeBuilder({
  tokens: { "color-primary-500": "#16a34a" },
})
  // .use(compatPlugin({ tailwind: true }))
  .use(basePlugin())
  .use(layoutPlugin({ container: "1280px" }))
  .use(componentsPlugin());

export const material = builder;
