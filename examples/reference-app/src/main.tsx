import React from "react";
import { createRoot } from "react-dom/client";
import { createBus } from "@kitsy/blu-bus";
import { BluProvider } from "@kitsy/blu-context";
import type { Projection } from "@kitsy/blu-core";
import { createSlate } from "@kitsy/blu-slate";
import { BroadcastChannelTransport } from "@kitsy/blu-wire";
import { App } from "./App";
import { appConfig } from "./app.config";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing root element.");
}

const bus = createBus();
const slate = createSlate();

bus.subscribe(
  () => true,
  async (event) => {
    try {
      await slate.append(event);
    } catch {
      // Already-seen event from cross-tab sync — slate dedupes by eventId.
    }
  },
);

// Stage 4 demo: cross-tab presence projection.
const presenceProjection: Projection<{ tabs: number }> = {
  name: "reference-presence",
  authority: "local-authoritative",
  initialState: { tabs: 1 },
  reduce: (state, event) => {
    if (event.type === "reference:tab-joined") {
      return { tabs: state.tabs + 1 };
    }
    if (event.type === "reference:tab-left") {
      return { tabs: Math.max(1, state.tabs - 1) };
    }
    return state;
  },
};
slate.registerProjection(presenceProjection);

// Cross-tab transport.
const transport = new BroadcastChannelTransport({
  channelName: `blu-${appConfig.id}`,
});

void (async () => {
  await transport.connect();

  bus.subscribe(
    (e) => e.durability === "replicated",
    async (event) => {
      await transport.offer(event);
    },
  );

  transport.receive(async (event) => {
    try {
      await slate.append(event);
    } catch {
      // Slate dedupes by eventId.
    }
  });

  await bus.emit({
    type: "reference:tab-joined",
    schemaVersion: 1,
    class: "system",
    durability: "replicated",
    payload: {},
    emitter: "urn:reference-app:bootstrap",
  });
})();

window.addEventListener("beforeunload", () => {
  void bus.emit({
    type: "reference:tab-left",
    schemaVersion: 1,
    class: "system",
    durability: "replicated",
    payload: {},
    emitter: "urn:reference-app:bootstrap",
  });
  void transport.disconnect();
});

createRoot(root).render(
  <React.StrictMode>
    <BluProvider bus={bus} slate={slate}>
      <App />
    </BluProvider>
  </React.StrictMode>,
);
