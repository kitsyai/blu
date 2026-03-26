import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createThemeBuilder } from "@kitsy/blu-style";
import { basePlugin } from "@kitsy/blu-core";
import { layoutPlugin } from "../src/builder/plugin/layout";
import { frameworkCss } from "../../../branding.config.js";

const outDir = resolve(process.cwd(), "dist");
mkdirSync(outDir, { recursive: true });

const builder = createThemeBuilder().use(basePlugin()).use(layoutPlugin());
const css = builder.toString({ minify: false });
const cssMin = builder.toString({ minify: true });

writeFileSync(resolve(outDir, frameworkCss.grid), css, "utf8");
writeFileSync(resolve(outDir, frameworkCss.gridMin), cssMin, "utf8");
