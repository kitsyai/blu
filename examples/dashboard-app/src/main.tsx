import React from "react";
import { createRoot } from "react-dom/client";
import { createBus } from "@kitsy/blu-bus";
import { BluProvider } from "@kitsy/blu-context";
import { createSlate } from "@kitsy/blu-slate";
import { BroadcastChannelTransport } from "@kitsy/blu-wire";
import type { DevtoolsTransportSnapshot } from "@kitsy/blu-devtools";
import {
  filterProjection,
  ordersByStatusProjection,
  ordersProjection,
  ordersTotalsProjection,
  presenceProjection,
} from "./projections";
import { DashboardRuntime } from "./runtime";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing #root element.");
}

const bus = createBus();
const slate = createSlate();

// Wire bus → slate so every observable+ event lands in the journal.
bus.subscribe(
  () => true,
  async (event) => {
    try {
      await slate.append(event);
    } catch {
      // Slate dedupes by eventId — duplicates from cross-tab sync are silent.
    }
  },
);

slate.registerProjection(ordersProjection);
slate.registerProjection(ordersByStatusProjection);
slate.registerProjection(ordersTotalsProjection);
slate.registerProjection(filterProjection);
slate.registerProjection(presenceProjection);

// Cross-tab sync via BroadcastChannel.
const transport = new BroadcastChannelTransport({ channelName: "blu-dashboard" });

let offered = 0;
let received = 0;

const transportSnapshot: DevtoolsTransportSnapshot = {
  name: "broadcast-channel",
  status: "connecting",
  offeredCount: 0,
  receivedCount: 0,
};

void (async () => {
  await transport.connect();
  transportSnapshot.status = transport.status;

  // Outbound: offer every replicated event to peers.
  bus.subscribe(
    (e) => e.durability === "replicated",
    async (event) => {
      const accepted = await transport.offer(event);
      if (accepted) {
        offered += 1;
        transportSnapshot.offeredCount = offered;
        transportSnapshot.lastEventType = event.type;
      }
    },
  );

  // Inbound: append directly to slate so the local bus does not re-broadcast.
  transport.receive(async (event) => {
    received += 1;
    transportSnapshot.receivedCount = received;
    transportSnapshot.lastEventType = event.type;
    try {
      await slate.append(event);
    } catch {
      // Already-seen event — slate dedupes by eventId.
    }
  });

  // Announce ourselves so the presence projection can count tabs.
  await bus.emit({
    type: "dashboard:tab-joined",
    schemaVersion: 1,
    class: "system",
    durability: "replicated",
    payload: {},
    emitter: "urn:dashboard:bootstrap",
  });
})();

window.addEventListener("beforeunload", () => {
  void bus.emit({
    type: "dashboard:tab-left",
    schemaVersion: 1,
    class: "system",
    durability: "replicated",
    payload: {},
    emitter: "urn:dashboard:bootstrap",
  });
  void transport.disconnect();
});

createRoot(root).render(
  <React.StrictMode>
    <BluProvider bus={bus} slate={slate}>
      <DashboardRuntime transportSnapshot={transportSnapshot} />
    </BluProvider>
  </React.StrictMode>,
);
