import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { material, app, ant } from "../src/theme";
import { frameworkCss } from "../../../branding.config.js";

const outDir = resolve(process.cwd(), "dist");
mkdirSync(outDir, { recursive: true });

writeFileSync(
  resolve(outDir, frameworkCss.shell),
  app.toString({ minify: false }),
  "utf8",
);
writeFileSync(
  resolve(outDir, frameworkCss.shellMin),
  app.toString({ minify: true }),
  "utf8",
);
writeFileSync(
  resolve(outDir, frameworkCss.material),
  material.toString({ minify: false }),
  "utf8",
);
writeFileSync(
  resolve(outDir, frameworkCss.materialMin),
  material.toString({ minify: true }),
  "utf8",
);
writeFileSync(
  resolve(outDir, frameworkCss.materialLegacy),
  material.toString({ minify: false, legacy: true }),
  "utf8",
);
writeFileSync(
  resolve(outDir, frameworkCss.materialLegacyMin),
  material.toString({ minify: true, legacy: true }),
  "utf8",
);
writeFileSync(
  resolve(outDir, frameworkCss.ant),
  ant.toString({ minify: false }),
  "utf8",
);
writeFileSync(
  resolve(outDir, frameworkCss.antMin),
  ant.toString({ minify: true }),
  "utf8",
);
