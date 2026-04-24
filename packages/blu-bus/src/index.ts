/**
 * @kitsy/blu-bus - in-process event transport for Blu.
 *
 * Provides event emission, subscriptions, middleware, causal propagation,
 * envelope validation, and subscriber-error isolation.
 */

export type {
  Bus,
  BusEmissionRejectedPayload,
  BusHandler,
  BusHandlerErrorPayload,
  BusMiddleware,
  BusOptions,
  EventFilter,
  EventFilterObject,
  EventPredicate,
} from "./bus.js";
export {
  BluBus,
  BUS_EMISSION_REJECTED_TYPE,
  BUS_HANDLER_ERROR_TYPE,
  createBus,
} from "./bus.js";
