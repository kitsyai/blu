import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useBus, useEmit, useSlate } from "@kitsy/blu-context";
import type { BluEvent, PartialEvent, Projection } from "@kitsy/blu-core";
import type { RouteEntry, RouteState, RouteTable } from "@kitsy/blu-schema";

export interface RouteHistoryDriver {
  mode: "history" | "hash" | "memory";
  read(): string;
  push(path: string): void;
  replace(path: string): void;
  subscribe(listener: () => void): () => void;
}

export interface BluRouterProps {
  routes: RouteTable;
  children: ReactNode;
  history?: RouteHistoryDriver;
}

export function BluRouter({
  routes,
  children,
  history,
}: BluRouterProps): ReactNode {
  const bus = useBus();
  const emit = useEmit();
  const slate = useSlate();
  const driver = useMemo(
    () => history ?? createBrowserHistoryDriver(routes.mode ?? "history"),
    [history, routes.mode],
  );
  const registrationRef = useRef<{
    key: string;
    unregister: () => void;
  } | null>(null);

  const registrationKey = JSON.stringify(routes);
  if (registrationRef.current?.key !== registrationKey) {
    registrationRef.current?.unregister();
    registrationRef.current = {
      key: registrationKey,
      unregister: registerRouteProjection(slate, routes, driver.read()),
    };
  }

  useEffect(() => {
    const syncFromDriver = () => {
      const nextPath = driver.read();
      void emitRouteEvent(
        emit,
        createNavigationPayload(routes, nextPath, driver.mode),
      );
    };

    const unsubscribeHistory = driver.subscribe(syncFromDriver);
    const unsubscribeBus = bus.subscribe("router:navigated", async (event) => {
      const payload = event.payload as RouterNavigatedPayload;
      if (payload.path !== driver.read()) {
        if (payload.replace) {
          driver.replace(payload.path);
        } else {
          driver.push(payload.path);
        }
      }
    });

    syncFromDriver();

    return () => {
      unsubscribeHistory();
      unsubscribeBus();
    };
  }, [bus, driver, emit, routes]);

  useEffect(() => {
    return () => {
      registrationRef.current?.unregister();
      registrationRef.current = null;
    };
  }, []);

  return children;
}

export function createRouteProjection(
  routes: RouteTable,
  initialPath: string = "/",
): Projection<RouteState> {
  return {
    name: "route:current",
    authority: "local-authoritative",
    initialState: resolveRouteState(
      routes,
      normalizePath(initialPath),
      routes.mode ?? "history",
    ),
    eventFilter: (event) => event.type === "router:navigated",
    reduce: (_state, event) => {
      const payload = event.payload as RouterNavigatedPayload;
      return resolveRouteState(routes, payload.path, payload.mode);
    },
  };
}

export function resolveRouteState(
  routes: RouteTable,
  path: string,
  mode: RouteHistoryDriver["mode"] = routes.mode ?? "history",
): RouteState {
  const normalizedPath = normalizePath(path);

  for (const route of routes.routes) {
    const params = matchRoutePath(route.path, normalizedPath);
    if (params === null) {
      continue;
    }

    return {
      mode,
      path: normalizedPath,
      routeId: route.id,
      params,
      meta: route.meta ?? {},
      matched: true,
    };
  }

  return {
    mode,
    path: normalizedPath,
    params: {},
    meta: {},
    matched: false,
  };
}

export function matchRoutePath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];
    if (patternPart === undefined || pathPart === undefined) {
      return null;
    }

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

export function registerRouteProjection(
  slate: ReturnType<typeof useSlate>,
  routes: RouteTable,
  initialPath: string = "/",
): () => void {
  try {
    const handle = slate.registerProjection(
      createRouteProjection(routes, initialPath),
    );
    return () => {
      handle.unregister();
    };
  } catch {
    return () => {};
  }
}

export function createMemoryHistoryDriver(
  initialPath: string = "/",
): RouteHistoryDriver & {
  back(): void;
  forward(): void;
} {
  const listeners = new Set<() => void>();
  const entries = [normalizePath(initialPath)];
  let index = 0;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    mode: "memory",
    read() {
      return entries[index] ?? "/";
    },
    push(path: string) {
      entries.splice(index + 1);
      entries.push(normalizePath(path));
      index = entries.length - 1;
    },
    replace(path: string) {
      entries[index] = normalizePath(path);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    back() {
      if (index === 0) {
        return;
      }
      index -= 1;
      notify();
    },
    forward() {
      if (index >= entries.length - 1) {
        return;
      }
      index += 1;
      notify();
    },
  };
}

export function createBrowserHistoryDriver(
  mode: RouteHistoryDriver["mode"],
  targetWindow: Window = window,
): RouteHistoryDriver {
  return {
    mode,
    read() {
      return readWindowPath(targetWindow, mode);
    },
    push(path: string) {
      if (mode === "hash") {
        targetWindow.location.hash = normalizeHashPath(path);
        return;
      }
      targetWindow.history.pushState({}, "", normalizePath(path));
    },
    replace(path: string) {
      if (mode === "hash") {
        targetWindow.location.replace(`#${normalizeHashPath(path)}`);
        return;
      }
      targetWindow.history.replaceState({}, "", normalizePath(path));
    },
    subscribe(listener: () => void) {
      const eventName = mode === "hash" ? "hashchange" : "popstate";
      targetWindow.addEventListener(eventName, listener);
      return () => {
        targetWindow.removeEventListener(eventName, listener);
      };
    },
  };
}

function createNavigationPayload(
  routes: RouteTable,
  path: string,
  mode: RouteHistoryDriver["mode"],
): RouterNavigatedPayload {
  const state = resolveRouteState(routes, path, mode);
  return {
    path: state.path,
    mode: state.mode,
    routeId: state.routeId,
    params: state.params,
    meta: state.meta,
    matched: state.matched,
  };
}

async function emitRouteEvent(
  emit: ReturnType<typeof useEmit>,
  payload: RouterNavigatedPayload,
): Promise<BluEvent<RouterNavigatedPayload>> {
  return emit({
    type: "router:navigated",
    schemaVersion: 1,
    class: "fact",
    durability: "observable",
    payload,
    emitter: "urn:blu:route",
    scopePath: "app/router",
    origin: "system",
  });
}

function splitPath(path: string): string[] {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    return [];
  }
  return normalized.slice(1).split("/");
}

function normalizePath(path: string): string {
  const value = path.trim();
  if (value.length === 0 || value === "#") {
    return "/";
  }
  if (value.startsWith("#")) {
    return normalizePath(value.slice(1));
  }
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

function normalizeHashPath(path: string): string {
  const normalized = normalizePath(path);
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function readWindowPath(
  targetWindow: Window,
  mode: RouteHistoryDriver["mode"],
): string {
  if (mode === "hash") {
    return normalizePath(targetWindow.location.hash);
  }
  return normalizePath(targetWindow.location.pathname);
}

interface RouterNavigatedPayload {
  path: string;
  mode: RouteHistoryDriver["mode"];
  routeId?: string;
  params: Record<string, string>;
  meta: Record<string, unknown>;
  matched: boolean;
  replace?: boolean;
}
