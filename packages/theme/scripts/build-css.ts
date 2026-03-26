import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createThemeBuilder } from "../src";
import { frameworkCss } from "../../../branding.config.js";

const outDir = resolve(process.cwd(), "dist");
mkdirSync(outDir, { recursive: true });

const builder = createThemeBuilder({});
// .use(compatPlugin({ tailwind: true }))
// .apply(
//   compatTailwindPlugin({
//     prefix: "",
//     important: false,
//     screens: {
//       xs: "360px",
//       sm: "640px",
//       md: "768px",
//       lg: "1024px",
//       xl: "1280px",
//       "2xl": "1536px",
//     },
//     // safelist: ["container", "md:hover:bg-blue-600", "ring"],
//   }),
// );

// Server-side or UMD: programmatically add classes your view will render
// builder.tw.add([
//   "text-sm",
//   "sm:text-lg",
//   "bg-slate-100/80",
//   "filter",
//   "blur-md",
//   "container",
//   "md:hover:bg-blue-600",
//   "ring",
// ]);

const css = builder.toString({ minify: false });
const cssMin = builder.toString({ minify: true });
const cssLegacy = builder.toString({ minify: false, legacy: true });
const cssLegacyMin = builder.toString({ minify: true, legacy: true });

writeFileSync(resolve(outDir, frameworkCss.style), css, "utf8");
writeFileSync(resolve(outDir, frameworkCss.styleMin), cssMin, "utf8");
writeFileSync(resolve(outDir, frameworkCss.styleLegacy), cssLegacy, "utf8");
writeFileSync(
  resolve(outDir, frameworkCss.styleLegacyMin),
  cssLegacyMin,
  "utf8",
);

// const cssCompat = builder.toString({ minify: false });
// const cssCompatMin = builder.toString({ minify: true });

// writeFileSync(resolve(outDir, "blu.style.compat.css"), cssCompat, "utf8");
// writeFileSync(resolve(outDir, "blu.style.compat.min.css"), cssCompatMin, "utf8");
