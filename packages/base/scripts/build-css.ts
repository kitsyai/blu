import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createThemeBuilder } from "@kitsy/blu-style";
import { basePlugin } from "../src/builder/plugin/base";
import { frameworkCss } from "../../../branding.config.js";

const outDir = resolve(process.cwd(), "dist");
mkdirSync(outDir, { recursive: true });

const builder = createThemeBuilder().use(basePlugin());
const css = builder.toString({ minify: false });
const cssMin = builder.toString({ minify: true });

writeFileSync(resolve(outDir, frameworkCss.core), css, "utf8");
writeFileSync(resolve(outDir, frameworkCss.coreMin), cssMin, "utf8");
