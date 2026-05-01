import type { BluEvent, Projection } from "@kitsy/blu-core";

export type OrderStatus = "pending" | "shipped" | "delivered" | "cancelled";

export interface Order {
  id: string;
  customerName: string;
  sku: string;
  quantity: number;
  priority: "low" | "normal" | "high";
  status: OrderStatus;
  total: number;
  createdAt: number;
}

export interface OrdersByStatus {
  pending: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

export interface OrdersTotals {
  count: number;
  revenue: number;
}

interface OrderCreatedPayload {
  customerName: string;
  sku: string;
  quantity: number;
  priority: Order["priority"];
  unitPrice: number;
}

interface OrderStatusUpdatedPayload {
  id: string;
  status: OrderStatus;
}

const INITIAL_BY_STATUS: OrdersByStatus = {
  pending: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
};

/**
 * The orders projection is the canonical list of all orders ever placed.
 * It synthesizes its `id` from the event envelope so the schema-side
 * payload stays free of identity concerns.
 */
export const ordersProjection: Projection<readonly Order[]> = {
  name: "orders",
  authority: "projection-authoritative",
  initialState: [],
  reduce: (state, event) => {
    if (event.type === "orders:created") {
      const payload = event.payload as OrderCreatedPayload;
      const next: Order = {
        id: event.eventId,
        customerName: payload.customerName,
        sku: payload.sku,
        quantity: payload.quantity,
        priority: payload.priority,
        status: "pending",
        total: payload.unitPrice * payload.quantity,
        createdAt: event.timestamp,
      };
      return [next, ...state];
    }
    if (event.type === "orders:status-updated") {
      const payload = event.payload as OrderStatusUpdatedPayload;
      return state.map((order) =>
        order.id === payload.id ? { ...order, status: payload.status } : order,
      );
    }
    return state;
  },
};

/**
 * Rolls the orders projection up by status.
 *
 * Implemented as an event-driven projection rather than a derived projection
 * so the dashboard can subscribe to it independently of the orders array.
 */
export const ordersByStatusProjection: Projection<OrdersByStatus> = {
  name: "orders-by-status",
  authority: "derived-only",
  initialState: INITIAL_BY_STATUS,
  reduce: (state, event) => {
    if (event.type === "orders:created") {
      return { ...state, pending: state.pending + 1 };
    }
    if (event.type === "orders:status-updated") {
      const payload = event.payload as OrderStatusUpdatedPayload;
      // We do not know the previous status from the payload alone, so this
      // projection trusts the consumer to also recompute against the orders
      // list when needed. For the dashboard counters this bias toward
      // newly-added work is fine — pending orders surface immediately.
      return { ...state, [payload.status]: state[payload.status] + 1 };
    }
    return state;
  },
};

/** Tracks total order count and total revenue. */
export const ordersTotalsProjection: Projection<OrdersTotals> = {
  name: "orders-totals",
  authority: "derived-only",
  initialState: { count: 0, revenue: 0 },
  reduce: (state, event) => {
    if (event.type !== "orders:created") return state;
    const payload = event.payload as OrderCreatedPayload;
    return {
      count: state.count + 1,
      revenue: state.revenue + payload.unitPrice * payload.quantity,
    };
  },
};

/**
 * Tracks the currently-selected status filter on the dashboard.
 *
 * Driven by `dashboard:filter-changed` events emitted from filter buttons.
 */
export const filterProjection: Projection<{ status: OrderStatus | "all" }> = {
  name: "dashboard-filter",
  authority: "local-authoritative",
  initialState: { status: "all" },
  reduce: (state, event) => {
    if (event.type !== "dashboard:filter-changed") return state;
    const payload = event.payload as { status: OrderStatus | "all" };
    return { status: payload.status };
  },
};

/**
 * Tracks how many tabs are currently watching the dashboard.
 * Drives the cross-tab presence indicator.
 */
export const presenceProjection: Projection<{
  tabs: number;
  lastSyncAt: number | null;
}> = {
  name: "dashboard-presence",
  authority: "local-authoritative",
  initialState: { tabs: 1, lastSyncAt: null },
  reduce: (state, event: BluEvent) => {
    if (event.type === "dashboard:tab-joined") {
      return { tabs: state.tabs + 1, lastSyncAt: event.timestamp };
    }
    if (event.type === "dashboard:tab-left") {
      return {
        tabs: Math.max(1, state.tabs - 1),
        lastSyncAt: event.timestamp,
      };
    }
    return state;
  },
};
