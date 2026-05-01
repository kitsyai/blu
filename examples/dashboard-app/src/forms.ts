import type { FormDefinition } from "@kitsy/blu-schema";

export const newOrderForm: FormDefinition = {
  id: "new-order",
  fields: {
    customerName: {
      type: "text",
      required: true,
      default: "",
      validation: { minLength: 2, maxLength: 64 },
    },
    sku: {
      type: "select",
      required: true,
      default: "SKU-001",
      enum: [
        { value: "SKU-001", label: "Widget Standard ($24)" },
        { value: "SKU-002", label: "Widget Premium ($59)" },
        { value: "SKU-003", label: "Widget Pro ($129)" },
      ],
    },
    quantity: {
      type: "number",
      required: true,
      default: 1,
      validation: { min: 1, max: 999 },
    },
    priority: {
      type: "select",
      required: true,
      default: "normal",
      enum: [
        { value: "low", label: "Low" },
        { value: "normal", label: "Normal" },
        { value: "high", label: "High" },
      ],
    },
  },
  // Submit: emit the canonical orders:created fact on the bus, reset the
  // form, then navigate back to the list. This is pure schema — no
  // imperative React glue.
  submitAction: {
    kind: "composite",
    steps: [
      {
        kind: "emit",
        type: "orders:created",
        class: "fact",
        durability: "replicated",
        payload: {
          customerName: { $bind: "form:new-order.values.customerName" },
          sku: { $bind: "form:new-order.values.sku" },
          quantity: { $bind: "form:new-order.values.quantity" },
          priority: { $bind: "form:new-order.values.priority" },
          unitPrice: 24,
        },
      },
      {
        kind: "form",
        op: "reset",
        form: "new-order",
      },
      {
        kind: "navigate",
        to: "/",
      },
    ],
  },
};
