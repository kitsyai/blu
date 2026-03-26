import { dts, esm, cjs, styles } from "../../build/rollup/index.js";

export default [
  esm({
    plugins: {
      postcss: {
        extract: false, // inject styles per used component
        minimize: true,
        sourceMap: true,
        // Inline a tiny injector to avoid external deps; keep plugin's own default export
        inject: (cssVarName) => `
          (function(css){
            if(!css) return;
            if(typeof document === 'undefined') return;
            var head = document.head || document.getElementsByTagName('head')[0];
            var style = document.createElement('style');
            style.type = 'text/css';
            style.setAttribute('data-pkvs', 'components');
            if (style.styleSheet){ style.styleSheet.cssText = css; }
            else { style.appendChild(document.createTextNode(css)); }
            head.appendChild(style);
          })(${cssVarName});
        `,
      },
    },
  }),
  cjs({
    plugins: {
      postcss: {
        extract: false, // inject styles per used component
        minimize: true,
        sourceMap: true,
        // Inline a tiny injector to avoid external deps; keep plugin's own default export
        inject: (cssVarName) => `
          (function(css){
            if(!css) return;
            if(typeof document === 'undefined') return;
            var head = document.head || document.getElementsByTagName('head')[0];
            var style = document.createElement('style');
            style.type = 'text/css';
            style.setAttribute('data-pkvs', 'components');
            if (style.styleSheet){ style.styleSheet.cssText = css; }
            else { style.appendChild(document.createTextNode(css)); }
            head.appendChild(style);
          })(${cssVarName});
        `,
      },
    },
  }),
  dts(),
  styles(),
];

// export default [
//   // 1. Build for ESM (and generate all type declarations)
//   {
//     input: 'src/index.ts',
//     output: {
//       dir: 'dist/esm',
//       format: 'esm',
//       sourcemap: true,
//       preserveModules: true,
//       preserveModulesRoot: 'src',
//     },
//     plugins: [
//       resolve(),
//       commonjs(),
//       postcss({
//         extract: false, // inject styles per used component
//         minimize: true,
//         sourceMap: true,
//         // Inline a tiny injector to avoid external deps; keep plugin's own default export
//         inject: (cssVarName) => `
//           (function(css){
//             if(!css) return;
//             if(typeof document === 'undefined') return;
//             var head = document.head || document.getElementsByTagName('head')[0];
//             var style = document.createElement('style');
//             style.type = 'text/css';
//             style.setAttribute('data-pkvs', 'components');
//             if (style.styleSheet){ style.styleSheet.cssText = css; }
//             else { style.appendChild(document.createTextNode(css)); }
//             head.appendChild(style);
//           })(${cssVarName});
//         `,
//       }),
//       typescript({
//         tsconfig: './tsconfig.json',
//         declaration: true,
//         declarationDir: './dist/esm/types', // Generate types into a temp folder
//       }),
//     ],
//     external: [
//       'react',
//       'react-dom',
//       '@kitsy/blu-core',
//       '@kitsy/blu-context',
//       '@kitsy/blu-grid',
//       '@kitsy/blu-route'
//     ],
//   },

//   // 2. Build for CJS
//   {
//     input: 'src/index.ts',
//     output: {
//       dir: 'dist/cjs',
//       format: 'cjs',
//       sourcemap: true,
//       exports: 'named',
//       preserveModules: true,
//       preserveModulesRoot: 'src',
//     },
//     plugins: [
//       resolve(),
//       commonjs(),
//       postcss({
//         extract: false, // inject styles per used component
//         minimize: true,
//         sourceMap: true,
//         inject: (cssVarName) => `
//           (function(css){
//             if(!css) return;
//             if(typeof document === 'undefined') return;
//             var head = document.head || document.getElementsByTagName('head')[0];
//             var style = document.createElement('style');
//             style.type = 'text/css';
//             style.setAttribute('data-pkvs', 'components');
//             if (style.styleSheet){ style.styleSheet.cssText = css; }
//             else { style.appendChild(document.createTextNode(css)); }
//             head.appendChild(style);
//           })(${cssVarName});
//         `,
//       }),
//       // In the CJS build, we DO NOT generate types
//       typescript({
//         tsconfig: './tsconfig.json',
//         declaration: false, // <-- This is the key
//       }),
//     ],
//     external: [
//       'react',
//       'react-dom',
//       '@kitsy/blu-core',
//       '@kitsy/blu-context',
//       '@kitsy/blu-grid',
//       '@kitsy/blu-route'
//     ],
//   },

//   // 3. Bundle all the type declarations into a single file
//   {
//     input: 'dist/esm/types/src/index.d.ts',
//     output: [{ file: 'dist/index.d.ts', format: 'esm', sourcemap: false }],
//     plugins: [dts()],
//     external: [/\.css$/],
//   },

//   // 4. Aggregated CSS build (SSR-friendly single stylesheet)
//   {
//     input: 'src/index.ts',
//     output: {
//       file: 'dist/esm/styles.build.js',
//       format: 'esm',
//       sourcemap: true,
//     },
//     plugins: [
//       resolve(),
//       commonjs(),
//       postcss({
//         extract: 'styles.css',
//         minimize: true,
//         sourceMap: true,
//       }),
//       typescript({
//         tsconfig: './tsconfig.json',
//         declaration: false,
//       }),
//     ],
//     treeshake: false,
//     external: [
//       'react',
//       'react-dom',
//       '@kitsy/blu-core',
//       '@kitsy/blu-context',
//       '@kitsy/blu-route'
//     ],
//   },
// ];
