import React from "react";
import { createRoot } from "react-dom/client";
import { createBus } from "@kitsy/blu-bus";
import { BluProvider } from "@kitsy/blu-context";
import { createSlate } from "@kitsy/blu-slate";
import { App } from "./App";

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
      <App />
    </BluProvider>
  </React.StrictMode>,
);
