
// import { toBrowserUrlString } from "./sharedUrl"; // build "browser://..." if you kept that scheme

import { EventBus } from "@kitsy/blu-bus";

function toBrowserUrlString(url: string) {
  return url;
}

export function attachServerAdapter(bus: EventBus, url: string) {
  // Prime initial location for router: **no DOM**, just message
  bus.send({ type: "replace", target: toBrowserUrlString(url) });
}
