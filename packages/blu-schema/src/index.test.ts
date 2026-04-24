import { describe, expect, it } from "vitest";
import type {
  Action,
  ApplicationConfiguration,
  Binding,
  ComponentMeta,
  Condition,
  DataSource,
  EmitAction,
  FormDefinition,
  RouteTable,
  ThemeConfiguration,
  ViewNode,
} from "./index.js";

// These tests are intentionally compile-time guards. If a public type
// changes shape in a backward-incompatible way, this file fails to
// type-check and CI breaks.

describe("schema public surface", () => {
  it("accepts a minimal ApplicationConfiguration", () => {
    const app: ApplicationConfiguration = {
      id: "demo",
      name: "Demo",
      version: "1.0.0",
      entry: { inline: { component: "urn:blu:ui:text", props: { value: "hi" } } },
    };
    expect(app.id).toBe("demo");
  });

  it("accepts a ViewNode with bindings, repeat, when, and actions", () => {
    const node: ViewNode = {
      component: "urn:blu:ui:list",
      bindings: {
        items: { source: "projection", path: "cart.items" },
      },
      when: { $truthy: { $bind: "cart.hasItems" } },
      repeat: {
        over: { source: "projection", path: "cart.items" },
        as: "item",
        key: "id",
      },
      actions: {
        click: {
          kind: "emit",
          type: "cart:item:remove-requested",
          payload: { itemId: { $bind: "item.id" } },
        },
      },
      children: [{ component: "urn:blu:ui:text" }],
    };
    expect(node.component).toBe("urn:blu:ui:list");
  });

  it("accepts every Action variant", () => {
    const actions: Action[] = [
      { kind: "navigate", to: "/home" },
      { kind: "emit", type: "noop", class: "intent" },
      { kind: "form", op: "submit", form: "checkout" },
      {
        kind: "composite",
        steps: [
          { kind: "form", op: "validate", form: "checkout" },
          { kind: "emit", type: "checkout:requested" },
        ],
        onError: { kind: "navigate", to: "/error" },
      },
    ];
    expect(actions).toHaveLength(4);
  });

  it("accepts every DataSource variant", () => {
    const sources: DataSource[] = [
      { kind: "rest", id: "users", url: "/api/users" },
      {
        kind: "graphql",
        id: "products",
        endpoint: "/graphql",
        query: "{ products { id } }",
      },
      { kind: "static", id: "constants", data: { tax: 0.07 } },
      { kind: "bus", id: "ticks", on: ["clock:tick"] },
      { kind: "projection", id: "summary", from: "cart", path: "totals" },
    ];
    expect(sources).toHaveLength(5);
  });

  it("accepts a Condition tree", () => {
    const cond: Condition = {
      $and: [
        { $eq: [{ $bind: "user.role" }, "admin"] },
        { $not: { $empty: { $bind: "user.email" } } },
        { $or: [{ $gt: [{ $bind: "user.age" }, 18] }, { $truthy: false }] },
      ],
    };
    expect(cond).toBeDefined();
  });

  it("accepts a FormDefinition with validation", () => {
    const form: FormDefinition = {
      id: "signup",
      fields: {
        email: { type: "text", required: true, validation: { pattern: ".+@.+" } },
        age: { type: "number", validation: { min: 13 } },
      },
      validation: [
        {
          id: "age-required-for-marketing",
          when: {
            $and: [
              { $truthy: { $bind: "form.signup.fields.marketingOptIn" } },
              { $empty: { $bind: "form.signup.fields.age" } },
            ],
          },
          message: "Age is required to opt in to marketing.",
          affects: ["age"],
        },
      ],
      submitAction: { kind: "emit", type: "signup:requested" },
    };
    expect(form.id).toBe("signup");
  });

  it("accepts a ComponentMeta", () => {
    const meta: ComponentMeta = {
      urn: "urn:blu:ui:button",
      displayName: "Button",
      description: "Action trigger.",
      category: "ui",
      version: "1.0.0",
      props: {
        type: "object",
        required: ["label"],
        properties: {
          label: { type: "string" },
          variant: {
            type: "enum",
            values: [
              { value: "primary", label: "Primary" },
              { value: "secondary", label: "Secondary" },
            ],
          },
        },
      },
      events: [{ type: "ui:button:clicked", class: "intent" }],
    };
    expect(meta.urn).toBe("urn:blu:ui:button");
  });

  it("accepts a RouteTable with guard, layout, and meta", () => {
    const routes: RouteTable = {
      mode: "history",
      routes: [
        {
          path: "/",
          view: { ref: "urn:app:view:home" },
          meta: { title: "Home" },
        },
        {
          path: "/admin",
          view: { ref: "urn:app:view:admin" },
          guard: { $eq: [{ $bind: "auth.role" }, "admin"] },
          layout: { ref: "urn:app:layout:admin" },
        },
      ],
      notFound: { ref: "urn:app:view:404" },
    };
    expect(routes.routes).toHaveLength(2);
  });

  it("accepts a ThemeConfiguration", () => {
    const theme: ThemeConfiguration = {
      namespace: "demo",
      colors: { primary: { 500: "#0044ff" }, surface: "#ffffff" },
      typography: { fontFamily: { sans: "Inter, sans-serif" } },
      spacing: { sm: 4, md: 8, lg: 16 },
    };
    expect(theme.namespace).toBe("demo");
  });

  it("treats Action#kind as a discriminator", () => {
    const action: Action = { kind: "emit", type: "demo" };
    if (action.kind === "emit") {
      const emit: EmitAction = action;
      expect(emit.type).toBe("demo");
    }
  });

  it("accepts Binding shapes for every source", () => {
    const bindings: Binding[] = [
      { source: "projection", path: "cart" },
      { source: "data", path: "users.items" },
      { source: "form", path: "signup.fields.email" },
      { source: "context", path: "tenant.id" },
    ];
    expect(bindings).toHaveLength(4);
  });
});
