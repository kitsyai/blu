import { dts, esm, cjs } from "../../build/rollup/index.js";

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
                    style.setAttribute('data-pkvs', 'layout');
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
            style.setAttribute('data-pkvs', 'layout');
            if (style.styleSheet){ style.styleSheet.cssText = css; }
            else { style.appendChild(document.createTextNode(css)); }
            head.appendChild(style);
          })(${cssVarName});
        `,
      },
    },
  }),
  dts(),
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
//             style.setAttribute('data-pkvs', 'layout');
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
//     external: ['react', 'react-dom', "@kitsy/blu-style", "@kitsy/blu-core"],
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
//             style.setAttribute('data-pkvs', 'layout');
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
//     external: ['react', 'react-dom', "@kitsy/blu-style", "@kitsy/blu-core"],
//   },

//   // 3. Bundle all the type declarations into a single file
//   {
//     input: 'dist/esm/types/src/index.d.ts',
//     output: [{ file: 'dist/index.d.ts', format: 'esm' }],
//     plugins: [dts()],
//     external: [/\.css$/],
//   },
// ];
