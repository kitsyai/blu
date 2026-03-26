import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createThemeBuilder } from "@kitsy/blu-style";
import { basePlugin } from "@kitsy/blu-core";
import { layoutPlugin } from "@kitsy/blu-grid";
import { componentsPlugin } from "@kitsy/blu-ui";
import { widgetsPlugin } from "../src/builder/plugin/widget";
import { frameworkCss } from "../../../branding.config.js";

const outDir = resolve(process.cwd(), "dist");
mkdirSync(outDir, { recursive: true });

const builder = createThemeBuilder()
  .use(basePlugin())
  .use(layoutPlugin())
  .use(componentsPlugin())
  .use(widgetsPlugin());
const css = builder.toString({ minify: false });
const cssMin = builder.toString({ minify: true });

writeFileSync(resolve(outDir, frameworkCss.blocks), css, "utf8");
writeFileSync(resolve(outDir, frameworkCss.blocksMin), cssMin, "utf8");
