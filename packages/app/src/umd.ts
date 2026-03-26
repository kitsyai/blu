import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from "react-dom/client";

import { render as _render } from './index';
export * from './index';
export { React, ReactDOM, ReactDOMClient };
import { frameworkBundles } from "../../../branding.config.js";

// ---- Auto-render from URL (?render=base64[&root=appId][&strict=1]) ----
(function autoRenderFromQuery(global: any) {
  if (typeof window === "undefined") return;

  const run = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("_render");
      if (!encoded) return;

      const rootId = params.get("_root") || "app";
      const strict = params.get("_strict") === "1";

      // support base64url too (-,_)
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "===".slice((normalized.length + 3) % 4);

      // decode UTF-8 safely
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const json = new TextDecoder("utf-8").decode(bytes);

      const appConfig = JSON.parse(json);

      // Your normal render
      if (typeof _render === "function") {
        _render(appConfig, { rootId, strictValidation: strict });
      } else if (
        global[frameworkBundles.globalName] &&
        typeof global[frameworkBundles.globalName].render === "function"
      ) {
        // fallback if needed
        global[frameworkBundles.globalName].render(appConfig, {
          rootId,
          strictValidation: strict,
        });
      } else {
        console.error(`[${frameworkBundles.globalName}] render() not found on window or module.`);
      }
    } catch (err) {
      console.error(`[${frameworkBundles.globalName}] Failed to auto-render from ?render=`, err);
    }
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    // macrotask ensures it runs after UMD assigns the global
    setTimeout(run, 0);
  }
  
})(typeof window !== "undefined" ? (window as any) : {});
