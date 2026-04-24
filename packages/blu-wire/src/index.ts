/**
 * @kitsy/blu-wire - transport contract and initial adapters for Blu.
 */

export type {
  BroadcastChannelConstructor,
  BroadcastChannelLike,
  Transport,
  TransportLifecycleListener,
  TransportLifecyclePayload,
  TransportReceiveHandler,
  TransportStatus,
} from "./transport.js";
export {
  BaseTransport,
  TRANSPORT_ERROR_EVENT_TYPE,
  TRANSPORT_RESUMED_EVENT_TYPE,
} from "./transport.js";

export type { LocalTransportOptions } from "./local-transport.js";
export { LocalTransport } from "./local-transport.js";

export type { BroadcastChannelTransportOptions } from "./broadcast-channel-transport.js";
export { BroadcastChannelTransport } from "./broadcast-channel-transport.js";
