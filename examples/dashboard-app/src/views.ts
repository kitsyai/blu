import type { ViewNode } from "@kitsy/blu-schema";

/**
 * One ViewNode tree per route, keyed by URN.
 *
 * Every interaction in this dashboard is described as schema data: bindings
 * resolve against projections and form state, conditions and repeat
 * directives drive list rendering, and actions translate clicks into events.
 */
export const dashboardViews: Record<string, ViewNode> = {
  // ─── ORDERS LIST ───────────────────────────────────────────────────────
  "urn:dashboard:view:orders-list": {
    component: "urn:blu:grid:stack",
    props: { gap: 16 },
    children: [
      // Header row: title + presence indicator + new-order button
      {
        component: "urn:blu:grid:row",
        props: { gap: 12 },
        children: [
          {
            component: "urn:blu:ui:text",
            props: { value: "Sales Orders" },
          },
          {
            component: "urn:blu:ui:text",
            props: { tone: "muted" },
            bindings: {
              value: { source: "projection", path: "dashboard-presence.tabs" },
            },
          },
          {
            component: "urn:blu:ui:button",
            props: { label: "+ New order" },
            actions: {
              onClick: { kind: "navigate", to: "/orders/new" },
            },
          },
        ],
      },

      // Totals card
      {
        component: "urn:blu:ui:card",
        children: [
          {
            component: "urn:blu:grid:stack",
            props: { gap: 8 },
            children: [
              {
                component: "urn:blu:ui:text",
                props: { value: "Totals", tone: "muted" },
              },
              {
                component: "urn:blu:grid:row",
                props: { gap: 24 },
                children: [
                  {
                    component: "urn:blu:ui:text",
                    bindings: {
                      value: {
                        source: "projection",
                        path: "orders-totals.count",
                      },
                    },
                  },
                  {
                    component: "urn:blu:ui:text",
                    bindings: {
                      value: {
                        source: "projection",
                        path: "orders-totals.revenue",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },

      // Filter buttons row
      {
        component: "urn:blu:grid:row",
        props: { gap: 8 },
        children: [
          {
            component: "urn:blu:ui:button",
            props: { label: "All" },
            actions: {
              onClick: {
                kind: "emit",
                type: "dashboard:filter-changed",
                class: "fact",
                durability: "observable",
                payload: { status: "all" },
              },
            },
          },
          {
            component: "urn:blu:ui:button",
            props: { label: "Pending" },
            actions: {
              onClick: {
                kind: "emit",
                type: "dashboard:filter-changed",
                class: "fact",
                durability: "observable",
                payload: { status: "pending" },
              },
            },
          },
          {
            component: "urn:blu:ui:button",
            props: { label: "Shipped" },
            actions: {
              onClick: {
                kind: "emit",
                type: "dashboard:filter-changed",
                class: "fact",
                durability: "observable",
                payload: { status: "shipped" },
              },
            },
          },
          {
            component: "urn:blu:ui:button",
            props: { label: "Delivered" },
            actions: {
              onClick: {
                kind: "emit",
                type: "dashboard:filter-changed",
                class: "fact",
                durability: "observable",
                payload: { status: "delivered" },
              },
            },
          },
        ],
      },

      // Empty state — only shown when there are no orders
      {
        component: "urn:blu:ui:card",
        when: {
          $eq: [{ $bind: "orders-totals.count" }, 0],
        },
        children: [
          {
            component: "urn:blu:ui:text",
            props: {
              value: "No orders yet. Click \"+ New order\" to add one.",
              tone: "muted",
            },
          },
        ],
      },

      // Orders list, repeated over the orders projection
      {
        component: "urn:blu:ui:card",
        repeat: {
          over: { source: "projection", path: "orders" },
          as: "order",
          key: "id",
        },
        children: [
          {
            component: "urn:blu:grid:row",
            props: { gap: 16 },
            children: [
              {
                component: "urn:blu:ui:text",
                props: { value: { $bind: "order.customerName" } },
              },
              {
                component: "urn:blu:ui:text",
                props: { value: { $bind: "order.sku" }, tone: "muted" },
              },
              {
                component: "urn:blu:ui:text",
                props: { value: { $bind: "order.quantity" } },
              },
              {
                component: "urn:blu:ui:text",
                props: {
                  value: { $bind: "order.status" },
                  tone: "muted",
                },
              },
              // High-priority highlight: only renders when priority is high
              {
                component: "urn:blu:ui:text",
                props: { value: "★ HIGH PRIORITY", tone: "danger" },
                when: {
                  $eq: [{ $bind: "order.priority" }, "high"],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ─── NEW ORDER FORM ────────────────────────────────────────────────────
  "urn:dashboard:view:new-order": {
    component: "urn:blu:grid:stack",
    props: { gap: 16 },
    children: [
      {
        component: "urn:blu:ui:text",
        props: { value: "New order" },
      },
      {
        component: "urn:blu:ui:card",
        children: [
          {
            component: "urn:blu:grid:stack",
            props: { gap: 12 },
            children: [
              {
                component: "urn:blu:ui:text",
                props: { value: "Customer name", tone: "muted" },
              },
              {
                component: "urn:blu:ui:input",
                props: { placeholder: "e.g. Acme Corp." },
                bindings: {
                  value: {
                    source: "form",
                    path: "form:new-order.values.customerName",
                  },
                },
                actions: {
                  onChange: {
                    kind: "form",
                    op: "setField",
                    form: "new-order",
                    field: "customerName",
                  },
                },
              },
              {
                component: "urn:blu:ui:text",
                props: { value: "Quantity", tone: "muted" },
              },
              {
                component: "urn:blu:ui:input",
                props: { placeholder: "1" },
                bindings: {
                  value: {
                    source: "form",
                    path: "form:new-order.values.quantity",
                  },
                },
                actions: {
                  onChange: {
                    kind: "form",
                    op: "setField",
                    form: "new-order",
                    field: "quantity",
                  },
                },
              },
              {
                component: "urn:blu:grid:row",
                props: { gap: 12 },
                children: [
                  {
                    component: "urn:blu:ui:button",
                    props: { label: "Cancel" },
                    actions: {
                      onClick: { kind: "navigate", to: "/" },
                    },
                  },
                  {
                    component: "urn:blu:ui:button",
                    props: { label: "Submit" },
                    actions: {
                      onClick: {
                        kind: "form",
                        op: "submit",
                        form: "new-order",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ─── 404 / NOT FOUND ──────────────────────────────────────────────────
  "urn:dashboard:view:not-found": {
    component: "urn:blu:grid:stack",
    props: { gap: 12 },
    children: [
      {
        component: "urn:blu:ui:text",
        props: { value: "Page not found" },
      },
      {
        component: "urn:blu:ui:button",
        props: { label: "Back to orders" },
        actions: { onClick: { kind: "navigate", to: "/" } },
      },
    ],
  },
};
