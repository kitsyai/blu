export const starterPackageJson = (name: string) => `{
  "name": "${name}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@kitsy/blu-bus": "1.0.0-dev.0",
    "@kitsy/blu-context": "1.0.0-dev.0",
    "@kitsy/blu-grid": "1.0.0-dev.0",
    "@kitsy/blu-route": "1.0.0-dev.0",
    "@kitsy/blu-shell": "1.0.0-dev.0",
    "@kitsy/blu-slate": "1.0.0-dev.0",
    "@kitsy/blu-style": "1.0.0-dev.0",
    "@kitsy/blu-ui": "1.0.0-dev.0",
    "@kitsy/blu-view": "1.0.0-dev.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "typescript": "^5.8.3",
    "vite": "^7.0.0"
  }
}
`;

export const starterIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blu Starter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

export const starterTsConfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
`;

export const starterViteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;

export const starterAppConfig = `import type { ApplicationConfiguration } from "@kitsy/blu-schema";

export const appConfig: ApplicationConfiguration = {
  id: "starter",
  name: "Blu Starter",
  version: "1.0.0",
  shell: {
    primary: "AppBar",
    primaryProps: {
      title: "Blu Starter",
    },
    defaultTheme: "light",
  },
  routes: {
    mode: "history",
    routes: [
      {
        id: "home",
        path: "/",
        view: {
          ref: "urn:app:view:home",
        },
        meta: {
          title: "Home",
        },
      },
      {
        id: "settings",
        path: "/settings",
        view: {
          ref: "urn:app:view:settings",
        },
        meta: {
          title: "Settings",
        },
      },
    ],
  },
  entry: {
    ref: "urn:app:view:home",
  },
  eventRegistry: [
    {
      type: "router:navigated",
      defaultClass: "fact",
      defaultDurability: "observable",
      schemaVersion: 1,
    },
  ],
};
`;

export const starterRegistry = `import { createComponentRegistry } from "@kitsy/blu-view";
import { bluGridEntries } from "@kitsy/blu-grid";
import { bluUiEntries } from "@kitsy/blu-ui";
import type { ViewNode } from "@kitsy/blu-schema";

const views: Record<string, ViewNode> = {
  "urn:app:view:home": {
    component: "urn:blu:grid:stack",
    props: { gap: 16 },
    children: [
      {
        component: "urn:blu:ui:card",
        children: [
          {
            component: "urn:blu:ui:text",
            props: { value: "Hello from Blu Starter" },
          },
        ],
      },
    ],
  },
  "urn:app:view:settings": {
    component: "urn:blu:grid:stack",
    props: { gap: 12 },
    children: [
      {
        component: "urn:blu:ui:text",
        props: { value: "Settings" },
      },
      {
        component: "urn:blu:ui:input",
        props: { value: "Account" },
      },
    ],
  },
};

export function createRegistry() {
  const registry = createComponentRegistry();
  for (const entry of [...bluGridEntries, ...bluUiEntries]) {
    registry.register(entry.urn, entry.component, entry.meta);
  }
  return { registry, views };
}
`;

export const starterMain = `import React from "react";
import { createRoot } from "react-dom/client";
import { createBus } from "@kitsy/blu-bus";
import { BluProvider } from "@kitsy/blu-context";
import { createSlate } from "@kitsy/blu-slate";
import { BluRouteShellApp } from "./runtime";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing root element.");
}

const bus = createBus();
const slate = createSlate();
bus.subscribe(() => true, async (event) => {
  await slate.append(event);
});

createRoot(root).render(
  <React.StrictMode>
    <BluProvider bus={bus} slate={slate}>
      <BluRouteShellApp />
    </BluProvider>
  </React.StrictMode>,
);
`;

export const starterRuntime = `import React from "react";
import { BluRouter } from "@kitsy/blu-route";
import { BluShell } from "@kitsy/blu-shell";
import { appConfig } from "./app.config";
import { createRegistry } from "./registry";

export function BluRouteShellApp() {
  const { registry, views } = createRegistry();
  const routes = appConfig.routes;
  if (routes === undefined) {
    throw new Error("Starter app requires routes.");
  }

  return (
    <BluRouter routes={routes}>
      <BluShell
        applicationId={appConfig.id}
        shell={appConfig.shell ?? { primary: "Blank" }}
        entry={views["urn:app:view:home"]}
        registry={registry}
      />
    </BluRouter>
  );
}
`;
