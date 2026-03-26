// src/server.ts
import * as React from "react";
import { ReactApplication } from "./ReactApplication";
import { attachServerAdapter } from "./adapters/server";
// import { getBus } from "./bus/factory";

import { renderToString } from "react-dom/server"; // blocking
import { renderToPipeableStream } from "react-dom/server"; // Node streams
import { NavigationProvider } from "@kitsy/blu-route";
import {
  ApplicationConfiguration,
  RenderOptions,
} from "./@types/ApplicationConfiguration";
import { compile } from "./utils/compile";
import { routes } from "./utils/routes";
import { AppConfig } from "./@types/AppConfig";
// For edge runtimes (optional):
// import { renderToReadableStream } from "react-dom/server";

export * from "./sc";

type SSRResult = {
  html: string; // app HTML
  head?: string; // head tags string (optional)
  dehydrated?: any; // your cache snapshot / initial state
  status?: number; // 200/301/404
  redirect?: string; // if any
  preload?: string[]; // link rel=preload/prefetch hints
};

export async function renderToStringSSR(
  app: AppConfig,
  url: string,
  opts?: RenderOptions,
): Promise<SSRResult> {
  // const bus = getBus("basic"); // or selectable "integrate"
  // attachServerAdapter(bus, url); // primes initial route from URL (no window)

  // Optionally kick prefetch plugins for this URL
  // if (opts?.prefetch) await opts.prefetch(bus, url);
  const { views, home, contextPath, init } = compile(app);
  const element = (
    <ReactApplication init={init} routes={routes(views, contextPath, home)} />
  );

  const html = renderToString(element);

  // Optional: head collection (if using react-helmet-async or your own collector)
  // const head = opts?.collectHead?.() ?? "";

  // Optional: collect dehydrated cache state
  // const dehydrated = opts?.collectDehydrated?.() ?? null;

  return { html, /*head, dehydrated,*/ status: 200 };
}

// Node streaming (Express/Fastify)
// export function renderToPipeableStreamSSR(app: Partial<ApplicationConfiguration>, url: string, opts?: any) {
//   const bus = getBus("basic");
//   attachServerAdapter(bus, url);

//   const element = (
//     <NavigationProvider>
//       <ReactApplication app={app} strictValidation={opts?.strict} />
//     </NavigationProvider>
//   );

//   return renderToPipeableStream(element, {
//     onShellReady() { /* write headers, start piping */ },
//     onAllReady()   { /* flush end */ },
//     onShellError(err) { /* 500 fallback */ },
//     onError(err)   { /* log */ },
//   });
// }

// Edge streaming (Vercel/Cloudflare) if you need it
// export async function renderToReadableStreamSSR(...) { ... }
