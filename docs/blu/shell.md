# Blu — Shell

**Status:** Canonical
**Scope:** The shell taxonomy, composition rules, and the contracts that every shell implementation satisfies.

Read `foundation.md`, `architecture.md`, and the relevant sections of `specification.md` first.

---

## 1. What a shell is

A shell is the top-level composition boundary of a Blu application. It is the component that wraps the entry view, renders application chrome (navigation, app bar, sidebars), hosts transient surfaces (modals, drawers, sheets), and displays application-wide overlays (maintenance banners, offline indicators, beta gates).

Every Blu application has exactly one shell mounted at the root. Applications without bespoke chrome use the `Blank` shell, which renders nothing but its children — it is still a shell.

Shell is a **dual-life** package. It is a view component (it renders), and it is an integration layer (it composes the route, the theme, the presenter stack, and the overlay system). It reads projections, emits events, and owns its own registered projections for shell-specific state.

---

## 2. Taxonomy

The shell taxonomy is a small, fixed vocabulary. Applications pick a shell by name; shells compose with other shell components through the composition rules in §4.

### 2.1 Primary shells

The primary shell determines the overall page structure. An application uses one primary at a time.

| Primary  | Purpose                                                              | Typical content                                |
|----------|----------------------------------------------------------------------|------------------------------------------------|
| `Blank`  | No chrome                                                            | Full-bleed experiences, embeds                 |
| `AppBar` | Top app bar with content below                                       | Most product UIs                               |
| `Nav`    | AppBar plus a persistent side navigation                             | Dashboards, back-office tools                  |
| `Game`   | Full-viewport canvas with edge-docked UI affordances                 | Interactive experiences, games                 |
| `Canvas` | A zoomable workspace with minimal chrome                             | Design tools, diagramming                      |
| `Doc`    | Reading-optimized container with gutters and a progress rail         | Long-form content, articles                    |
| `Wizard` | Step-navigator chrome with forward/back controls                     | Onboarding, multi-step forms                   |

### 2.2 Presenters

Presenters are the transient surfaces that appear in front of the primary content. A shell can host multiple presenter instances at once, stacked.

| Presenter | Attachment                   | Typical use                                    |
|-----------|------------------------------|------------------------------------------------|
| `Modal`   | Centered, focus-trapped      | Confirmations, dialogs, focused tasks          |
| `Drawer`  | Edge-docked (top/right/bottom/left) | Settings panels, filters, detail inspectors |
| `Sheet`   | Bottom-attached, often mobile | Action sheets, quick picks                    |

### 2.3 Overlays

Overlays sit above presenters. They are application-wide status indicators and gates.

| Overlay         | Behavior                                                    |
|-----------------|-------------------------------------------------------------|
| `Beta`          | Declares the application is in beta; optionally gated        |
| `Maintenance`   | Displays maintenance state; may block interaction           |
| `Offline`       | Indicates transport-level disconnection                      |
| `Banner`        | Generic single-line banner with configurable severity       |

---

## 3. Shell state is a projection

Every shell registers a projection named `shell:{applicationId}` that tracks its composable state:

```typescript
interface ShellState {
  primary: PrimaryKind;
  presenters: PresenterInstance[];
  overlays: OverlayInstance[];
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
}

interface PresenterInstance {
  id: string;
  kind: "modal" | "drawer" | "sheet";
  attachment?: "top" | "right" | "bottom" | "left";
  content: ViewNode;
  dismissOn?: "backdrop" | "escape" | "both" | "none";
  zOrder: number;
}

interface OverlayInstance {
  id: string;
  kind: "beta" | "maintenance" | "offline" | "banner";
  severity?: "info" | "warning" | "error";
  message?: string;
  dismissible?: boolean;
  blocksInteraction?: boolean;
}
```

The projection's authority is `local-authoritative` — shell state is a session-level concern. An application that wants a presenter to persist across reloads (a drawer that remembers its open state) declares a separate `browser-authoritative` projection for that field and binds the drawer's attachment state to it.

Shell state is not special. It is a projection like any other, subscribed to by the shell's render function.

---

## 4. Composition rules

Composition proceeds from outermost to innermost:

```
overlays → presenters → primary → application entry
```

- **Overlays** render above everything. Multiple overlays stack in z-order.
- **Presenters** render above the primary content. Multiple presenters stack in z-order; the top presenter receives focus.
- **Primary** renders the page-level chrome and hosts the application's entry view.
- **Application entry** is the ViewNode tree the application provides.

A shell implementation composes these layers using standard view composition — there is no shell-specific rendering mechanism. The shell reads its state projection, walks it, and renders each layer in order.

### 4.1 Dismissal

Dismissal is an event emission. A user pressing Escape on a modal emits `shell:presenter:dismiss-requested` with the presenter id. The shell subscribes to this intent, decides whether to dismiss (based on the presenter's `dismissOn` policy), and emits `shell:presenter:dismissed` as a fact.

This applies to every interaction with shell state. There is no imperative `shell.dismiss()` method — everything is an event.

---

## 5. Events

Shell defines a namespace of events. These are the canonical event types that shell implementations emit and consume.

```
shell:primary:switched              class: fact
shell:presenter:open-requested      class: intent
shell:presenter:opened              class: fact
shell:presenter:dismiss-requested   class: intent
shell:presenter:dismissed           class: fact
shell:overlay:show-requested        class: intent
shell:overlay:shown                 class: fact
shell:overlay:dismiss-requested     class: intent
shell:overlay:dismissed             class: fact
shell:theme:change-requested        class: intent
shell:theme:changed                 class: fact
shell:density:changed               class: fact
```

Every shell interaction fits in this registry. Applications that want custom chrome behavior subscribe to these intents and emit additional domain events as needed.

---

## 6. ShellAPI

The shell exposes a hooks-based API for application code that needs programmatic access.

```typescript
function useShell(): ShellAPI;

interface ShellAPI {
  state: ShellState;                             // Current projection output
  actions: {
    openPresenter: (p: Omit<PresenterInstance, "id" | "zOrder">) => string;
    dismissPresenter: (id: string) => void;
    showOverlay: (o: Omit<OverlayInstance, "id">) => string;
    dismissOverlay: (id: string) => void;
    setTheme: (t: ShellState["theme"]) => void;
    setDensity: (d: ShellState["density"]) => void;
  };
}
```

The action functions are conveniences. Each compiles to an event emission; for example, `openPresenter({ ... })` emits `shell:presenter:open-requested` and, on fact acknowledgment, resolves to the presenter id.

Application code that prefers to stay with raw event emissions can ignore `useShell` and emit directly with `useEmit`.

---

## 7. Shell authoring

An application authors a shell configuration as part of its `ApplicationConfiguration`:

```typescript
interface ApplicationConfiguration {
  // ...other fields...
  shell?: ShellConfiguration;
}

interface ShellConfiguration {
  primary: PrimaryKind;
  primaryProps?: Record<string, PropValue>;      // Title, nav items, etc.
  defaultTheme?: "light" | "dark" | "system";
  defaultDensity?: "comfortable" | "compact";
  overlays?: ShellOverlayDeclaration[];          // Policy, not content
}
```

The shell configuration is data. It seeds the shell projection on startup. Everything after is event-driven.

---

## 8. Conformance

Every shell implementation — the `Blank`, `AppBar`, `Nav`, `Game`, `Canvas`, `Doc`, `Wizard` primaries — conforms to these rules:

1. Renders by subscribing to the shell state projection via `useProjection`.
2. Handles user interaction by emitting events via `useEmit`.
3. Implements no imperative API for opening presenters or overlays beyond the hooks in §6.
4. Passes the shell conformance test suite, which exercises open/dismiss cycles for every presenter and overlay class.
5. Accepts theme and density changes without full re-mounts.

A shell that does not meet these is not a shell. It is a view component.

---

## 9. What shell is not

- Shell is not a router. `blu-route` owns routing. The shell consumes the current route projection and uses it to decide what the primary's title is, but it does not own history, parameters, or navigation.
- Shell is not a layout library. `blu-grid` owns layout primitives. The shell uses grid to arrange its chrome but does not re-export layout concerns.
- Shell is not a theming system. `blu-style` owns the CSS cascade and tokens. The shell exposes theme-change events and applies the theme to its boundaries; it does not define tokens.
- Shell is not a modal library. Modals exist as a presenter kind under the shell's ownership; there is no independent `blu-modal` package.

---

## 10. Related documents

- `docs/blu/foundation.md` — principles.
- `docs/blu/architecture.md` — layering and package map.
- `docs/blu/specification.md` — event envelope, projections, hooks.
- `docs/blu/execution.md` — when shell ships.
