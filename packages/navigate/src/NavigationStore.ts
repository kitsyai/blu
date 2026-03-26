import { bus, Command } from "@kitsy/blu-bus";

type Location = {
  path: string;
  query: Record<string, string>;
  hash: string | null;
};

type Listener = (loc: Location) => void;

class NavigationStore {
  private listeners = new Set<Listener>();
  private _location: Location;

  constructor(initial: string = "/") {
    this._location = this.parse(initial);

    bus.subscribe((cmd) => this.onCommand(cmd));
  }

  public reset(path: string = "/") {
    this._location = this.parse(path);
  }

  private parse(url: string): Location {
    const parsed = new URL(url, "http://dummy");
    return {
      path: parsed.pathname,
      query: Object.fromEntries(parsed.searchParams.entries()),
      hash: parsed.hash ? parsed.hash.slice(1) : null,
    };
  }

  get location() {
    return this._location;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this._location); // fire immediately
    return () => this.listeners.delete(listener);
  }

  // navigate(to: string) {
  //   this._location = this.parse(to);
  //   for (const l of this.listeners) l(this._location);
  // }

  // INTERNAL: called from bus
  private onCommand(cmd: Command) {
    console.log("NavigationStore: received command", cmd);
    switch (cmd.type) {
      case "navigate":
      case "replace":
        if (typeof cmd.target === "string") {
          this._location = this.parse(cmd.target);
          this.emit();
        }
        break;
      // back/forward are handled by adapters; they will translate into navigate/replace
      default:
        break;
    }
  }

  private emit() {
    console.log("NavigationStore: emitting command", this._location);
    for (const l of this.listeners) l(this._location);
  }
}

export const navigationStore = new NavigationStore("/");

export function attachBrowserAdapter(contextPath: string = "/") {
  const currentUrl =
    window.location.pathname + window.location.search + window.location.hash;
  const initialUrl = currentUrl || contextPath || "/";

  console.log(
    "reseting the navigation store to account for current location: ",
    initialUrl,
  );

  navigationStore.reset(initialUrl);

  const onPop = () => {
    // navigationStore.navigate(window.location.pathname + window.location.search + window.location.hash);
    bus.send({
      type: "navigate",
      target:
        window.location.pathname +
        window.location.search +
        window.location.hash,
    });
  };

  // Sync from browser → store
  window.addEventListener("popstate", onPop);

  // Sync from store → browser
  const unsub = navigationStore.subscribe((loc) => {
    const url =
      loc.path +
      (Object.keys(loc.query).length
        ? "?" + new URLSearchParams(loc.query).toString()
        : "") +
      (loc.hash ? "#" + loc.hash : "");
    const current =
      window.location.pathname + window.location.search + window.location.hash;
    if (url !== current) {
      window.history.pushState({}, "", url);
    }
  });

  return () => {
    window.removeEventListener("popstate", onPop);
    unsub();
  };
}

export function attachMemoryAdapter(start: string = "/") {
  // navigationStore.navigate(start);
  bus.send({ type: "replace", target: start });
  return () => {}; // no-op cleanup
}
