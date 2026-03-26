import { isExternal, EXTERNAL_PEERS, extend } from "./utils.js";
import {
  basePlugins,
  tscPlugin,
  replacePlugin,
  minify,
  rollupDts,
} from "./plugins.js";
import { frameworkBundles } from "../../branding.config.js";

export const dts = () =>
  extend({
    input: "dist/esm/types/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "esm" }],
    plugins: [rollupDts()],
    external: [/\.css$/],
  });

export const serverDts = () =>
  extend({
    // 5. Bundle all the type declarations into a single file
    input: "dist/esm/types/server.d.ts",
    output: [{ file: "dist/server.d.ts", format: "esm" }],
    plugins: [rollupDts()],
    external: [/\.css$/],
  });

export const esm = (options = {}) =>
  extend({
    input: "src/index.ts",
    external: isExternal,
    plugins: [basePlugins(options), tscPlugin({ declaration: true })],
    output: {
      dir: "dist/esm",
      format: "esm",
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: "src",
    },
  });

export const cjs = () =>
  extend({
    input: "src/index.ts",
    external: isExternal,
    plugins: [basePlugins(), tscPlugin()],
    output: {
      dir: "dist/cjs",
      format: "cjs",
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: "src",
      exports: "named",
    },
  });

export const umd = () =>
  extend({
    input: "src/umd.ts",
    external: [],
    output: {
      file: `dist/umd/${frameworkBundles.standalone}`,
      format: "umd",
      name: frameworkBundles.globalName,
      sourcemap: true,
      exports: "named",
    },
    plugins: [replacePlugin(), basePlugins(), tscPlugin(), minify()],
  });

export const umdLean = () =>
  extend({
    input: "src/umd.ts",
    external: [...EXTERNAL_PEERS],
    plugins: [replacePlugin(), basePlugins(), tscPlugin(), minify()],
    output: {
      file: `dist/umd/${frameworkBundles.lean}`,
      format: "umd",
      name: frameworkBundles.globalName,
      sourcemap: true,
      exports: "named",
      globals: {
        react: "React",
        "react-dom": "ReactDOM",
      },
    },
  });

export const ssr = () =>
  extend({
    input: "src/server.tsx",
    external: [
      "react",
      "react-dom/server", // don’t bundle node/server renderer
      // plus anything you want external on server side
    ],
    plugins: [basePlugins(), tscPlugin()],
    output: [
      { file: "dist/esm/server.js", format: "esm", sourcemap: true },
      {
        file: "dist/cjs/server.js",
        format: "cjs",
        sourcemap: true,
        exports: "named",
      },
    ],
  });

export const styles = () =>
  extend({
    input: "src/index.ts",
    external: isExternal,
    output: {
      file: "dist/esm/styles.build.js",
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      basePlugins({
        plugins: {
          postcss: { extract: "styles.css", minimize: true, sourceMap: true },
        },
      }),
      tscPlugin(),
    ],
    treeshake: false,
  });

// Build CSS-only: pkvsinha.css + pkvsinha.min.css
// {
//   input: path.resolve("src/styles/index.css"), // imports 01→07 in order
//   plugins: [
//     postcss({
//       extract: "pkvsinha.css",
//       sourceMap: true,
//       minimize: false,
//       plugins: [
//         postcssImport(),
//         postcssNesting(),
//         autoprefixer(),
//       ],
//     }),
//   ],
//   output: { dir: "dist", assetFileNames: "[name][extname]" },
// },
// {
//   input: path.resolve("src/styles/index.css"),
//   plugins: [
//     postcss({
//       extract: "pkvsinha.min.css",
//       sourceMap: false,
//       minimize: {
//         preset: ["default", { discardComments: { removeAll: true } }],
//       },
//       plugins: [
//         postcssImport(),
//         postcssNesting(),
//         autoprefixer(),
//         cssnano(),
//       ],
//     }),
//   ],
//   output: { dir: "dist", assetFileNames: "[name][extname]" },
// },
