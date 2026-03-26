import * as React from "react";
import { createRoot } from "react-dom/client";
import { ReactApplication } from "./ReactApplication";
import { registerSW } from "./sw/register";
import type {
  ApplicationConfiguration,
  RenderOptions,
} from "./@types/ApplicationConfiguration";
import { attachBrowserAdapter } from "@kitsy/blu-route";
import { createThemeBuilder } from "@kitsy/blu-style";
import { compile } from "./utils/compile";
import { routes } from "./utils/routes";
import type { AppConfig } from "./@types/AppConfig";

function attachCss() {
  const builder = createThemeBuilder();
  // builder.use(compatPlugin({ tailwind: true }));
  builder.inject();
}

export function render(app?: AppConfig, options?: RenderOptions) {
  const rootElement = getRootElement(options);
  const root = createRoot(rootElement);
  const { views, home, contextPath, init } = compile(app);

  root.render(
    <ReactApplication init={init} routes={routes(views, contextPath, home)} />,
  );
  attachBrowserAdapter(app?.contextPath);
  if (options?.css?.attach) {
    attachCss();
  }

  // registerSW();
}

function getRootElement(options: RenderOptions | undefined) {
  let rootElement = document.getElementById(options?.rootId || "root");
  if (!rootElement) {
    rootElement = document.getElementById("app");
  }

  if (!rootElement) {
    rootElement = document.createElement("div");
    rootElement.id = options?.rootId || "root";
    document.body.appendChild(rootElement);
  }
  return rootElement;
}
