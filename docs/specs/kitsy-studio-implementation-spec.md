# Kitsy Studio — Implementation Specification

**Status:** Canonical — implementation specification for Kitsy Studio
**Scope:** Phase 3 deliverable — `@kitsy/studio`, `@kitsy/canvas`
**License:** Proprietary
**Read first:** `docs/blu/foundation.md`, `docs/blu/architecture.md`, `docs/blu/specification.md` (§11 ViewNode, §12 Actions, §15 Component Registry and URNs), `docs/specs/blu-component-specifications.md`

---

## Table of Contents

1. [Overview & Design Goals](#1-overview--design-goals)
2. [System Architecture](#2-system-architecture)
3. [Package Structure](#3-package-structure)
4. [The Canvas Model](#4-the-canvas-model)
5. [Component Palette](#5-component-palette)
6. [Property Panel](#6-property-panel)
7. [Live Preview](#7-live-preview)
8. [Drag-and-Drop Engine](#8-drag-and-drop-engine)
9. [Undo/Redo System](#9-undoredo-system)
10. [Multi-View & Page Management](#10-multi-view--page-management)
11. [Data Source Editor](#11-data-source-editor)
12. [Action Wiring UI](#12-action-wiring-ui)
13. [Theme Editor](#13-theme-editor)
14. [Responsive Editing](#14-responsive-editing)
15. [Template Browser & Marketplace](#15-template-browser--marketplace)
16. [Collaboration (Real-Time)](#16-collaboration-real-time)
17. [Keyboard Shortcuts & Accessibility](#17-keyboard-shortcuts--accessibility)
18. [Studio ↔ Server Sync](#18-studio--server-sync)
19. [Studio ↔ Mind Integration](#19-studio--mind-integration)
20. [Implementation Sequence](#20-implementation-sequence)

---

## 1. Overview & Design Goals

Kitsy Studio is a visual, no-code editor that produces `ApplicationConfiguration` documents. It is itself a Blu app — proving Blu's power while being a proprietary Kitsy product. Every edit in Studio is a bus command. The config is the single artifact — Studio doesn't generate code.

### 1.1 Design goals

| Goal | Constraint |
|------|-----------|
| **Config-native** | Studio edits ApplicationConfiguration directly. No intermediate representation. Every action produces a JSON Patch on the config. |
| **Bus-first** | Every edit, selection, and undo is a bus command. Studio's own state management uses the same EventBus pattern as any Blu app. |
| **Eat your own cooking** | Studio is built with Blu components and runs inside `@kitsy/blu-shell`. The property panel, palette, and toolbar are Blu ViewNodes. |
| **AI-ready** | Studio's edit operations are the same operations Kitsy Mind invokes. An AI edit and a human edit are indistinguishable at the config level. |
| **Real-time collaborative** | Two users editing the same site see each other's changes live via Kitsy Server sync protocol. |
| **Not pixel-perfect** | Studio is a structured editor, not a free-form canvas. Users compose from the component catalog with constrained placement — not arbitrary drag-to-pixel positioning. This is intentional. |

### 1.2 What Studio is NOT

- Not a pixel-perfect design tool (that's Figma's job)
- Not a code editor (that's VS Code's job)
- Not a database admin tool (data sources are configured, not queried interactively)
- Not an animation timeline editor (interactions are wired through Action declarations)

### 1.3 Competitive positioning

Studio competes on **structural understanding**, not visual flexibility. Unlike Webflow (pixel-level CSS control) or Framer (design-tool metaphor), Studio knows what each component IS — its props, slots, constraints, data bindings, and allowed children. This makes Studio less flexible for arbitrary visual design but far more reliable for:

- AI-assisted editing (Mind can patch any component because it understands the schema)
- Multi-device preview (components handle their own responsiveness)
- Data-connected experiences (data bindings are first-class in the property panel)
- Business-grade reliability (configs are validated on every edit)

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Kitsy Studio                                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Studio Shell (Blu App)                    │  │
│  │  ┌──────────┐  ┌───────────────────┐  ┌──────────────────┐  │  │
│  │  │ Toolbar   │  │  Workspace        │  │  Right Panel     │  │  │
│  │  │           │  │  ┌─────────────┐  │  │  ┌────────────┐ │  │  │
│  │  │ • Save    │  │  │  Canvas     │  │  │  │ Properties │ │  │  │
│  │  │ • Undo    │  │  │  (ViewNode  │  │  │  │ Panel      │ │  │  │
│  │  │ • Redo    │  │  │   tree      │  │  │  │            │ │  │  │
│  │  │ • Preview │  │  │   editor)   │  │  │  │ - Props    │ │  │  │
│  │  │ • Publish │  │  │             │  │  │  │ - Data     │ │  │  │
│  │  │ • AI Chat │  │  └──────┬──────┘  │  │  │ - Actions  │ │  │  │
│  │  │ • Device  │  │         │         │  │  │ - Style    │ │  │  │
│  │  │   toggle  │  │  ┌──────▼──────┐  │  │  │ - A11y     │ │  │  │
│  │  └──────────┘  │  │  Preview     │  │  │  └────────────┘ │  │  │
│  │                │  │  (iframe)    │  │  │  ┌────────────┐ │  │  │
│  │  ┌──────────┐  │  │  running Blu │  │  │  │ Component  │ │  │  │
│  │  │ Left     │  │  │  app from    │  │  │  │ Tree       │ │  │  │
│  │  │ Panel    │  │  │  current     │  │  │  │ (outline)  │ │  │  │
│  │  │          │  │  │  config      │  │  │  └────────────┘ │  │  │
│  │  │ • Pages  │  │  └─────────────┘  │  │                  │  │  │
│  │  │ • Palette│  │                    │  │                  │  │  │
│  │  │ • Assets │  │                    │  │                  │  │  │
│  │  │ • Data   │  │                    │  │                  │  │  │
│  │  │ • Theme  │  │                    │  │                  │  │  │
│  │  └──────────┘  │                    │  │                  │  │  │
│  │                └────────────────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                     ┌────────▼────────┐                             │
│                     │  Builder State  │                             │
│                     │  Manager        │                             │
│                     │  (AppConfig in  │                             │
│                     │   memory, every │                             │
│                     │   edit = bus    │                             │
│                     │   command)      │                             │
│                     └────────┬────────┘                             │
│                              │                                      │
│                     ┌────────▼────────┐                             │
│                     │  Sync to Kitsy  │                             │
│                     │  Server (§10    │                             │
│                     │  of Server Spec)│                             │
│                     └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Package Structure

### 3.1 `@kitsy/studio` (Proprietary)

```
@kitsy/studio/
├── src/
│   ├── shell/
│   │   ├── StudioApp.tsx             # Root Blu app config for Studio
│   │   ├── StudioLayout.tsx          # Main layout: toolbar + left + workspace + right
│   │   └── StudioContext.tsx         # Studio-specific context (selection, mode, etc.)
│   ├── toolbar/
│   │   ├── Toolbar.tsx
│   │   ├── DeviceToggle.tsx          # Desktop / tablet / mobile preview
│   │   ├── UndoRedoButtons.tsx
│   │   ├── PublishButton.tsx
│   │   └── AIButton.tsx              # Opens Mind chat panel
│   ├── palette/
│   │   ├── ComponentPalette.tsx      # Browseable catalog from ComponentRegistry
│   │   ├── PaletteCategory.tsx
│   │   ├── PaletteItem.tsx           # Draggable component card
│   │   └── PaletteSearch.tsx
│   ├── canvas/
│   │   ├── CanvasEditor.tsx          # ViewNode tree visual editor
│   │   ├── CanvasNode.tsx            # Selectable, hoverable wrapper per ViewNode
│   │   ├── DropZone.tsx              # Drop targets between/inside nodes
│   │   ├── SelectionOverlay.tsx      # Blue border + resize handles on selected node
│   │   └── BreadcrumbBar.tsx         # Shows path to selected node
│   ├── preview/
│   │   ├── PreviewFrame.tsx          # iframe manager
│   │   └── PreviewBridge.ts          # postMessage ↔ bus bridge
│   ├── properties/
│   │   ├── PropertyPanel.tsx         # Main panel, tab-based
│   │   ├── PropsTab.tsx              # Auto-generated from propSchema
│   │   ├── DataTab.tsx               # Data binding editor
│   │   ├── ActionsTab.tsx            # Action wiring UI
│   │   ├── StyleTab.tsx              # Spacing, sizing, visual overrides
│   │   ├── ResponsiveTab.tsx         # Per-breakpoint overrides
│   │   ├── A11yTab.tsx               # Accessibility hints and labels
│   │   └── fields/                   # Property field renderers
│   │       ├── StringField.tsx
│   │       ├── NumberField.tsx
│   │       ├── BooleanField.tsx
│   │       ├── SelectField.tsx
│   │       ├── ColorField.tsx
│   │       ├── SpacingField.tsx
│   │       ├── IconField.tsx
│   │       ├── ImageField.tsx
│   │       └── JSONField.tsx          # Fallback for complex/unknown schemas
│   ├── outline/
│   │   ├── ComponentTree.tsx         # Hierarchical node tree (left panel)
│   │   ├── TreeNode.tsx
│   │   └── TreeDragHandle.tsx        # Reorder via tree drag
│   ├── pages/
│   │   ├── PageList.tsx              # View/page management
│   │   ├── PageSettings.tsx          # Meta, route, permissions per page
│   │   └── PageCreate.tsx
│   ├── data/
│   │   ├── DataSourceList.tsx        # Manage data sources
│   │   ├── DataSourceEditor.tsx      # Configure adapter, URL, auth
│   │   └── DataPreview.tsx           # Live data fetch preview
│   ├── theme/
│   │   ├── ThemeEditor.tsx           # Token editor (colors, typography, spacing)
│   │   ├── ColorPicker.tsx
│   │   ├── TypographyEditor.tsx
│   │   └── ThemePreview.tsx          # Live preview of token changes
│   ├── state/
│   │   ├── BuilderStateManager.ts    # Central config state + undo history
│   │   ├── SelectionState.ts         # Currently selected ViewNode(s)
│   │   ├── ClipboardState.ts         # Copy/paste buffer
│   │   └── DragState.ts              # Active drag operation
│   ├── operations/                    # Pure functions: config → config
│   │   ├── insertNode.ts
│   │   ├── removeNode.ts
│   │   ├── moveNode.ts
│   │   ├── updateNodeProps.ts
│   │   ├── updateNodeStyle.ts
│   │   ├── updateNodeData.ts
│   │   ├── updateNodeActions.ts
│   │   ├── wrapNode.ts               # Wrap selection in a container
│   │   ├── unwrapNode.ts
│   │   ├── duplicateNode.ts
│   │   └── applyTemplate.ts          # Replace subtree with template
│   └── commands/                      # Bus command types for Studio
│       ├── studio.commands.ts
│       └── studio.effects.ts
├── tests/
└── package.json
```

### 3.2 `@kitsy/canvas` (Proprietary)

The canvas package is the **pure logic layer** — no React, no UI. It provides ViewNode tree manipulation, validation, and diffing. Studio UI consumes this; Kitsy Mind also consumes this (for programmatic edits).

```
@kitsy/canvas/
├── src/
│   ├── tree/
│   │   ├── ViewNodeTree.ts           # Immutable tree structure
│   │   ├── traverse.ts               # Walk, find, filter, map over nodes
│   │   ├── path.ts                   # Node path resolution (parent chain)
│   │   └── diff.ts                   # Tree diff → JSON Patch
│   ├── operations/
│   │   ├── insert.ts                 # Insert node at position
│   │   ├── remove.ts                 # Remove node by ID
│   │   ├── move.ts                   # Move node to new parent/position
│   │   ├── update.ts                 # Update props, style, data, actions
│   │   ├── wrap.ts                   # Wrap node in container
│   │   ├── unwrap.ts                 # Remove wrapper, keep children
│   │   ├── duplicate.ts              # Deep clone with new IDs
│   │   └── replace.ts               # Replace subtree (template application)
│   ├── constraints/
│   │   ├── validatePlacement.ts      # Can this component go here?
│   │   ├── validateProps.ts          # Do props match propSchema?
│   │   └── validateTree.ts           # Full tree constraint validation
│   ├── selection/
│   │   ├── SelectionModel.ts         # Single and multi-select
│   │   └── SelectionOperations.ts    # Group operations on selection
│   ├── history/
│   │   ├── UndoStack.ts             # Command-based undo/redo
│   │   └── ConfigSnapshot.ts        # Snapshot for undo boundaries
│   ├── clipboard/
│   │   ├── copy.ts                   # Serialize selection to clipboard format
│   │   ├── paste.ts                  # Deserialize and insert with new IDs
│   │   └── ClipboardFormat.ts
│   ├── idgen.ts                      # Deterministic ID generation for new nodes
│   └── index.ts
├── tests/
└── package.json
```

**Key design decision:** `@kitsy/canvas` has zero UI dependencies. It operates on pure data (ViewNode trees, ApplicationConfiguration). This means:

1. Studio uses it for visual editing
2. Kitsy Mind uses it for programmatic AI edits
3. CLI uses it for config manipulation scripts
4. Server uses it for config validation on save

---

## 4. The Canvas Model

### 4.1 Editing model

Studio does NOT directly mutate the ApplicationConfiguration. Instead:

```
User action (drag, type, click)
    ↓
Studio dispatches bus command: { type: "studio:edit", payload: { operation, params } }
    ↓
BuilderStateManager receives command
    ↓
BuilderStateManager calls @kitsy/canvas operation (pure function)
    ↓
Canvas operation returns new config (immutable)
    ↓
BuilderStateManager pushes old config to undo stack
    ↓
BuilderStateManager sets new config as current
    ↓
BuilderStateManager computes JSON Patch (old → new)
    ↓
BuilderStateManager dispatches: { type: "sync:config:propose", payload: { patch } }
    ↓
Kitsy Server validates and accepts/rejects
    ↓
Preview iframe receives updated config via postMessage
    ↓
Preview re-renders affected ViewNodes
```

### 4.2 Edit operations (canonical list)

Every user action maps to exactly one operation:

| Operation | Parameters | Description |
|-----------|-----------|-------------|
| `insertNode` | `{ parentId, position, node }` | Add component to tree |
| `removeNode` | `{ nodeId }` | Delete component |
| `moveNode` | `{ nodeId, newParentId, newPosition }` | Reorder or reparent |
| `updateProps` | `{ nodeId, props }` | Change component props |
| `updateStyle` | `{ nodeId, style }` | Change inline styles |
| `updateData` | `{ nodeId, data }` | Change data binding |
| `updateActions` | `{ nodeId, event, action }` | Wire/change an action |
| `updateResponsive` | `{ nodeId, breakpoint, overrides }` | Set responsive override |
| `wrapNode` | `{ nodeId, wrapperUrn }` | Wrap in container |
| `unwrapNode` | `{ nodeId }` | Remove wrapper, keep children |
| `duplicateNode` | `{ nodeId }` | Deep clone |
| `replaceSubtree` | `{ nodeId, newTree }` | Replace with template/AI output |
| `addView` | `{ view }` | Add new page/view |
| `removeView` | `{ viewId }` | Delete page |
| `updateViewMeta` | `{ viewId, meta }` | Change page settings |
| `addDataSource` | `{ dataSource }` | Add data source to config |
| `updateDataSource` | `{ sourceId, updates }` | Edit data source config |
| `removeDataSource` | `{ sourceId }` | Delete data source |
| `updateTheme` | `{ tokenPath, value }` | Change theme token |
| `updateGlobalState` | `{ key, value }` | Set default global state |

### 4.3 Constraint enforcement

Before any operation executes, `@kitsy/canvas` validates constraints:

```typescript
function validatePlacement(
  parentUrn: string,
  childUrn: string,
  position: number,
  registry: ComponentRegistry
): PlacementResult {
  const parentMeta = registry.getMeta(parentUrn);
  const childMeta = registry.getMeta(childUrn);

  // Check allowedChildren on parent
  if (parentMeta.constraints?.allowedChildren) {
    if (!parentMeta.constraints.allowedChildren.includes(childUrn)) {
      return { valid: false, reason: `${parentMeta.displayName} doesn't accept ${childMeta.displayName}` };
    }
  }

  // Check allowedParents on child
  if (childMeta.constraints?.allowedParents) {
    if (!childMeta.constraints.allowedParents.includes(parentUrn)) {
      return { valid: false, reason: `${childMeta.displayName} can't be placed in ${parentMeta.displayName}` };
    }
  }

  // Check maxChildren
  if (parentMeta.constraints?.maxChildren !== undefined) {
    const currentChildren = getChildren(parentUrn).length;
    if (currentChildren >= parentMeta.constraints.maxChildren) {
      return { valid: false, reason: `${parentMeta.displayName} already has maximum children` };
    }
  }

  // Check slot constraints
  // ...

  return { valid: true };
}
```

Invalid operations are silently rejected in the UI (drop zone doesn't highlight) and return an error if called programmatically (for AI/CLI use).

---

## 5. Component Palette

### 5.1 Palette data source

The palette reads directly from `ComponentRegistry.getAllMeta()`. No separate palette configuration needed.

```typescript
// Palette displays components grouped by category
const categories = [
  { key: "layout", label: "Layout", icon: "layout" },
  { key: "primitive", label: "Primitives", icon: "box" },
  { key: "input", label: "Inputs", icon: "text-cursor" },
  { key: "display", label: "Display", icon: "eye" },
  { key: "feedback", label: "Feedback", icon: "alert-circle" },
  { key: "navigation", label: "Navigation", icon: "compass" },
  { key: "media", label: "Media", icon: "image" },
  { key: "marketing", label: "Marketing", icon: "megaphone" },
  { key: "data", label: "Data", icon: "database" },
  { key: "form", label: "Forms", icon: "file-text" },
];

// Each palette item shows:
// - Thumbnail (from ComponentMeta.thumbnail)
// - Display name
// - Category badge
// - Drag handle (for drag-to-canvas)
```

### 5.2 Search and filter

```typescript
// Fuzzy search across displayName, description, and tags
palette.search("hero banner");
// → matches urn:blu:block:hero (displayName: "Hero Banner", tags: ["hero", "banner", ...])

// Category filter
palette.filter({ category: "marketing" });
// → hero, features, pricing, testimonials, cta, team, logo-cloud, banner
```

### 5.3 Palette → Canvas flow

```
User drags "Hero Banner" from palette
  ↓
DragState activates with: { type: "palette", urn: "urn:blu:block:hero", defaultProps: {...} }
  ↓
Canvas shows valid drop zones (green highlights)
  - Checks constraints: can Hero go here?
  - Root level: ✅ (standalone: true)
  - Inside a Card: ❌ (Hero not in Card's allowedChildren)
  ↓
User drops on valid zone
  ↓
Studio dispatches: insertNode({ parentId, position, node: { 
  id: generateId(), 
  componentUrn: "urn:blu:block:hero", 
  props: heroMeta.defaultProps 
}})
  ↓
Node appears in canvas + preview
  ↓
New node auto-selected → Property panel opens
```

---

## 6. Property Panel

### 6.1 Auto-generation from propSchema

The property panel is dynamically generated from `ComponentMeta.propSchema` (JSON Schema). No manual UI mapping per component.

```typescript
// JSON Schema type → Property field renderer
const SCHEMA_TO_FIELD: Record<string, React.FC> = {
  "string":                    StringField,
  "string+enum":               SelectField,
  "string+format:color":       ColorField,
  "string+format:uri+image":   ImageField,
  "string+format:uri":         StringField,       // with URL validation
  "number":                    NumberField,
  "number+minimum+maximum":    SliderField,        // range
  "boolean":                   BooleanField,
  "integer":                   NumberField,
  "object":                    JSONField,          // collapsible sub-object
  "array+items:string":        TagListField,       // multi-value string array
  "array+items:object":        ArrayEditor,        // repeatable sub-form
};

// The panel walks the propSchema and renders appropriate fields:
function renderPropertyFields(schema: JSONSchema, values: Record<string, unknown>, onChange: (key, value) => void) {
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const FieldComponent = resolveFieldComponent(propSchema);
    yield <FieldComponent
      key={key}
      label={propSchema.title || key}
      description={propSchema.description}
      value={values[key]}
      schema={propSchema}
      required={schema.required?.includes(key)}
      onChange={(value) => onChange(key, value)}
    />;
  }
}
```

### 6.2 Panel tabs

| Tab | Content | When Visible |
|-----|---------|-------------|
| **Props** | Auto-generated from propSchema | Always (when node selected) |
| **Data** | Data binding editor (source, mapping, loading/error/empty states) | Always |
| **Actions** | Event → Action wiring for onClick, onSubmit, etc. | Always |
| **Style** | Spacing, sizing, overflow, visibility, custom CSS class | Always |
| **Responsive** | Per-breakpoint prop and style overrides | Always |
| **A11y** | Accessibility labels, ARIA hints, contrast checker | Always |

### 6.3 No-selection state

When nothing is selected, the right panel shows:

- Page-level settings (current view's meta, permissions, data prefetch)
- Global state defaults
- Site-level settings (brand, navigation config)

---

## 7. Live Preview

### 7.1 Architecture

The preview is an **iframe running a real Blu app** from the current ApplicationConfiguration. It's not a mock or wireframe — it's the actual rendered output.

```typescript
// Studio side: PreviewBridge
class PreviewBridge {
  private iframe: HTMLIFrameElement;
  private channel = new MessageChannel();

  // Send updated config to preview
  updateConfig(config: ApplicationConfiguration): void {
    this.iframe.contentWindow.postMessage({
      type: "studio:config-update",
      config,
    }, "*");
  }

  // Send incremental patch (more efficient for small edits)
  patchConfig(patch: JSONPatch[]): void {
    this.iframe.contentWindow.postMessage({
      type: "studio:config-patch",
      patch,
    }, "*");
  }

  // Receive events from preview (hover, click for selection)
  onPreviewEvent(handler: (event: PreviewEvent) => void): void {
    window.addEventListener("message", (e) => {
      if (e.data?.type?.startsWith("preview:")) handler(e.data);
    });
  }
}

// Preview side: PostMessageTransport
// The preview iframe loads Blu with a special PostMessageTransport
// that bridges to the Studio's bus via window.postMessage
// This makes the preview a real bus participant
```

### 7.2 Preview ↔ Studio interaction

```
STUDIO → PREVIEW:
  studio:config-update    Full config replacement
  studio:config-patch     Incremental JSON Patch
  studio:select-node      Highlight a node (from tree click)
  studio:hover-node       Hover highlight (from tree hover)
  studio:set-breakpoint   Switch preview to device width

PREVIEW → STUDIO:
  preview:node-clicked    User clicked a node in preview → select in Studio
  preview:node-hovered    User hovered a node → highlight in tree
  preview:rendered        Preview finished rendering → show in canvas
  preview:error           Render error → show in Studio status bar
```

### 7.3 Device preview

```typescript
const DEVICE_PRESETS = {
  desktop:  { width: "100%", height: "100%", label: "Desktop" },
  laptop:   { width: "1280px", height: "800px", label: "Laptop" },
  tablet:   { width: "768px", height: "1024px", label: "Tablet" },
  mobile:   { width: "375px", height: "812px", label: "Mobile" },
};

// Preview iframe is resized to match device preset
// Blu components respond via their responsive breakpoint system
```

---

## 8. Drag-and-Drop Engine

### 8.1 Drag sources

| Source | Payload | Origin |
|--------|---------|--------|
| Palette item | `{ type: "palette", urn, defaultProps }` | Component palette |
| Canvas node | `{ type: "move", nodeId }` | Canvas (reorder) |
| Tree node | `{ type: "move", nodeId }` | Component tree (reorder) |
| Template | `{ type: "template", templateId, content }` | Template browser |

### 8.2 Drop targets

Drop zones appear dynamically based on constraint validation:

```
BETWEEN siblings:     Horizontal line between two nodes
INSIDE container:     Dashed outline around container (at end of children)
INTO slot:            Named slot area with label (e.g., "Header", "Footer")
REPLACE:              Over an existing node (with modifier key held)
```

### 8.3 Drop zone computation

```typescript
function computeDropZones(
  dragPayload: DragPayload,
  tree: ViewNodeTree,
  registry: ComponentRegistry
): DropZone[] {
  const zones: DropZone[] = [];
  const dragUrn = dragPayload.type === "palette" ? dragPayload.urn : getNodeUrn(dragPayload.nodeId);

  for (const node of tree.walk()) {
    const nodeMeta = registry.getMeta(node.componentUrn);

    // Check if this node can accept the dragged component as child
    const placement = validatePlacement(node.componentUrn, dragUrn, 0, registry);
    if (placement.valid) {
      // Add zone: inside this node (append)
      zones.push({ parentId: node.id, position: "append", rect: computeRect(node) });

      // Add zones: between each pair of children
      for (let i = 0; i <= (node.children?.length || 0); i++) {
        zones.push({ parentId: node.id, position: i, rect: computeGapRect(node, i) });
      }
    }

    // Check named slots
    for (const slot of nodeMeta.slots || []) {
      if (slot.allowedComponents && !slot.allowedComponents.includes(dragUrn)) continue;
      zones.push({ parentId: node.id, slot: slot.name, position: 0, rect: computeSlotRect(node, slot) });
    }
  }

  // Filter out self-reference (can't drop a node into itself)
  if (dragPayload.type === "move") {
    return zones.filter(z => !isDescendantOf(z.parentId, dragPayload.nodeId, tree));
  }

  return zones;
}
```

### 8.4 Implementation note

Use native HTML5 Drag and Drop for cross-browser compatibility. Supplement with pointer events for touch devices. The drag preview shows a ghost of the component's thumbnail from ComponentMeta.

---

## 9. Undo/Redo System

### 9.1 Command-based undo

Every edit operation is pushed to an undo stack as a config snapshot (or inverse patch).

```typescript
class UndoStack {
  private undoStack: ConfigSnapshot[] = [];
  private redoStack: ConfigSnapshot[] = [];
  private maxSize = 100;

  push(snapshot: ConfigSnapshot): void {
    this.undoStack.push(snapshot);
    this.redoStack = []; // Clear redo on new action
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
  }

  undo(currentConfig: ApplicationConfiguration): ApplicationConfiguration | null {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return null;
    this.redoStack.push({ config: currentConfig, label: snapshot.label });
    return snapshot.config;
  }

  redo(currentConfig: ApplicationConfiguration): ApplicationConfiguration | null {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return null;
    this.undoStack.push({ config: currentConfig, label: snapshot.label });
    return snapshot.config;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  // For UI display
  undoLabel(): string | undefined { return this.undoStack.at(-1)?.label; }
  redoLabel(): string | undefined { return this.redoStack.at(-1)?.label; }
}

interface ConfigSnapshot {
  config: ApplicationConfiguration;
  label: string; // "Insert Hero Banner", "Change headline text", "Delete Card"
}
```

### 9.2 Undo batching

Rapid changes (e.g., typing text, dragging a slider) are batched into single undo entries using a debounce:

```typescript
// Typing "Hello" produces 5 keystrokes but ONE undo entry
// Debounce: 500ms of inactivity → close the batch and push snapshot
```

---

## 10. Multi-View & Page Management

### 10.1 Page list (left panel)

```
Pages
├── home          (/)          [default]
├── about         (/about)
├── products      (/products)
├── product-detail (/products/:id)
├── contact       (/contact)
└── + Add Page
```

### 10.2 Page operations

| Operation | UI | Effect |
|-----------|-----|--------|
| Add page | + button → name/route dialog | Adds ViewDefinition to config.views |
| Delete page | Context menu → confirm dialog | Removes ViewDefinition |
| Rename | Double-click label | Updates view.id and route |
| Reorder | Drag in page list | Changes order in config.views |
| Set as home | Context menu | Sets config.home |
| Page settings | Click gear icon | Opens: meta (title, description, OG), permissions, data prefetch, layout |

### 10.3 Navigation configuration

Studio includes a navigation editor that manages `config.navigation`:

- Add/remove/reorder nav links
- Map links to views (internal) or URLs (external)
- Configure dropdown menus (nested links)
- Preview in navbar component

---

## 11. Data Source Editor

### 11.1 Data source management panel

```
Data Sources
├── products-api     REST    https://api.example.com/products
├── blog-posts       REST    https://api.example.com/posts
├── site-settings    Static  (inline JSON)
├── user-profile     Bus     user:profile
└── + Add Data Source
```

### 11.2 Data source configuration form

Generated from the DataSource schema (`docs/blu/specification.md` §14 DataSource). Fields vary by adapter type:

| Adapter | Configuration Fields |
|---------|---------------------|
| REST | URL, method, headers, query params, auth |
| GraphQL | Endpoint, query, variables |
| Static | Inline JSON editor |
| Bus | Topic name |
| State | State key path |
| Supabase | Table, select columns, filter, order |

### 11.3 Data preview

After configuring a data source, "Test" button fetches live data and displays it in a table format. This helps users verify their data source is configured correctly before binding it to components.

### 11.4 Binding data to components

In the Property Panel → Data tab:

```
Data Binding
├── Source: [products-api ▾]
├── Mapping:
│   ├── title  →  products[0].name
│   ├── price  →  products[0].price
│   └── image  →  products[0].imageUrl
├── Loading: [Skeleton ▾]
├── Error:   [Alert ▾] [Retry: ✓]
└── Empty:   [Text: "No products found" ▾]
```

For repeater/list components:

```
Repeat
├── Source: [products-api ▾]
├── Item variable: product
├── Key field: product.id
├── Template: [Product Card] (click to edit)
└── Pagination: [Load More ▾] Page size: [12]
```

---

## 12. Action Wiring UI

### 12.1 Actions tab in Property Panel

For any ViewNode, the Actions tab shows available events and their wired actions:

```
Actions
├── onClick:      [Navigate → /products/:id ▾]        [✕]
├── onLoad:       [Fetch Data → products-api ▾]        [✕]
├── onVisible:    [Bus Command → analytics:view ▾]     [✕]
├── onSubmit:     (not applicable for this component)
└── + Add Action
```

### 12.2 Action builder (modal)

When user clicks to wire an action, a builder modal appears:

```
┌─────────────────────────────────────────┐
│  Configure Action                        │
│                                         │
│  Type: [Navigate       ▾]              │
│                                         │
│  ── Navigate Settings ──                │
│  Path: [/products/__  ]                 │
│  Replace: [ ] (push by default)         │
│                                         │
│  ── OR ──                               │
│                                         │
│  Type: [Mutate Data    ▾]              │
│  Source: [products-api ▾]               │
│  Action: [delete       ▾]              │
│  On Success: [Toast: "Deleted" ▾]       │
│  On Error:   [Toast: "Failed"  ▾]       │
│                                         │
│  ── OR ──                               │
│                                         │
│  Type: [Sequence       ▾]              │
│  1. [Mutate → cart-api → addItem]       │
│  2. [State → set → cart.count += 1]     │
│  3. [Toast → "Added to cart!"]          │
│  + Add Step                             │
│                                         │
│  [Cancel]                [Save Action]  │
└─────────────────────────────────────────┘
```

The builder produces a serializable Action object (`docs/blu/specification.md` §12 Actions) — no code, just data.

---

## 13. Theme Editor

### 13.1 Token editing

The theme editor provides visual controls for all ThemeTokens (Component Spec §11.1):

```
Theme
├── Colors
│   ├── Primary:    [██████] #2563EB    (full scale: 50-900)
│   ├── Secondary:  [██████] #7C3AED
│   ├── Neutral:    [██████] #6B7280
│   ├── Success:    [██████] #059669
│   ├── Warning:    [██████] #D97706
│   ├── Error:      [██████] #DC2626
│   └── Background: [██████] #FFFFFF
├── Typography
│   ├── Sans font:  [Inter ▾]
│   ├── Serif font: [Merriweather ▾]
│   ├── Mono font:  [JetBrains Mono ▾]
│   ├── Base size:  [16px ▾]
│   └── Scale:      [1.25 (Major Third) ▾]
├── Spacing
│   └── Base unit:  [4px ▾]  (xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48)
├── Radius
│   └── Base:       [6px ▾]  (sm=3, md=6, lg=12, full=9999)
└── Shadows
    └── Preset:     [Subtle ▾ | Medium | Dramatic]
```

### 13.2 Live preview

Theme changes apply instantly to the preview iframe. CssBuilder regenerates CSS custom properties and injects them into the preview. User sees the result in real-time without saving.

### 13.3 Color scale generation

When user picks a primary color, Studio auto-generates the full 50-900 scale using an HSL-based algorithm (lighten for 50-400, darken for 600-900, user's pick = 500).

---

## 14. Responsive Editing

### 14.1 Device toggle

Toolbar includes device presets (Desktop, Tablet, Mobile). Switching devices:

1. Resizes the preview iframe
2. Switches the property panel to show breakpoint-specific overrides
3. Canvas highlights which props have responsive overrides (small badge icon)

### 14.2 Responsive property editing

In the Props tab, each responsive-capable prop shows a breakpoint indicator:

```
Height:  [lg ▾]    ← current value for all breakpoints
         [md]  Mobile override: [md ▾]    [✕ remove override]
```

When user switches to mobile preview and changes a prop, Studio automatically creates a responsive override for the `sm` breakpoint rather than changing the base prop.

---

## 15. Template Browser & Marketplace

### 15.1 Template browser (left panel tab)

```
Templates
├── My Templates (saved from current tenant)
├── Starter Templates
│   ├── SaaS Landing
│   ├── Business Card
│   ├── Portfolio
│   └── Simple Storefront
├── Section Templates
│   ├── Hero + Features
│   ├── Pricing Section
│   └── Contact + Map
└── Marketplace (browse community templates)
```

### 15.2 Template operations

| Operation | Flow |
|-----------|------|
| **Use template** | Select template → Preview → "Use This" → new site config created from template |
| **Insert section** | Drag section template onto canvas → inserts ViewNode subtree |
| **Save as template** | Select nodes → right-click → "Save as Template" → stored in tenant's template library |
| **Publish to marketplace** | From "My Templates" → "Publish" → review process → available to all kitsy.ai users |

### 15.3 Template as config

Templates are stored as ApplicationConfiguration documents (for site templates) or ViewNode[] arrays (for section templates) in the ConfigStore with `tenantId: "marketplace"` for public templates. They pass the same validation pipeline as any config.

---

## 16. Collaboration (Real-Time)

### 16.1 Architecture

Real-time collaboration uses the existing Kitsy Server sync protocol (Server Spec §10). Multiple Studio instances connected to the same siteId see each other's edits.

### 16.2 Presence

```typescript
// Bus commands for collaboration awareness
type CollabCommand =
  | { type: "collab:cursor", payload: { userId, nodeId, position } }
  | { type: "collab:selection", payload: { userId, nodeIds } }
  | { type: "collab:typing", payload: { userId, nodeId, field } };

// Each collaborator gets a colored cursor/highlight
// Selection conflicts: last-writer-wins at the prop level
// Two users can edit different props of the same node simultaneously
```

### 16.3 Conflict resolution in Studio

When two users edit the same prop simultaneously:

1. Both apply optimistically
2. Server receives both — last-writer-wins
3. "Losing" client receives corrective patch
4. UI shows brief flash indicating external change
5. Undo stack only contains local changes (not remote)

---

## 17. Keyboard Shortcuts & Accessibility

### 17.1 Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + S` | Save (sync to server) |
| `Ctrl/Cmd + C` | Copy selected node(s) |
| `Ctrl/Cmd + V` | Paste |
| `Ctrl/Cmd + D` | Duplicate selected node |
| `Delete / Backspace` | Delete selected node |
| `Escape` | Deselect / close panel |
| `Tab` | Select next sibling |
| `Shift + Tab` | Select previous sibling |
| `Enter` | Select first child |
| `Ctrl/Cmd + Enter` | Select parent |
| `Arrow keys` | Navigate in tree (when tree focused) |
| `Ctrl/Cmd + P` | Toggle preview mode (full-screen preview) |
| `Ctrl/Cmd + /` | Open AI chat (Mind) |

### 17.2 Studio accessibility

Studio itself meets WCAG AA. All panels are keyboard-navigable. Screen reader announcements for edit operations ("Hero Banner inserted", "Headline updated"). High-contrast mode available.

---

## 18. Studio ↔ Server Sync

### 18.1 Auto-save

Studio auto-saves to Kitsy Server:

- **On every edit:** JSON Patch sent via `sync:config:propose` (Server Spec §10.1)
- **Debounced:** Patches batched over 500ms to avoid flooding
- **Status indicator:** "Saved ✓" / "Saving..." / "Offline (changes queued)"
- **Conflict:** If server rejects a patch (validation failure), Studio shows error and reverts the edit

### 18.2 Offline support

If WebSocket disconnects:

1. Studio continues working locally (all edits applied to in-memory config)
2. Edits queued in `@kitsy/blu-sync` OfflineQueue
3. Status bar shows "Offline — changes will sync when reconnected"
4. On reconnect: queued patches replayed, server resolves conflicts

---

## 19. Studio ↔ Mind Integration

### 19.1 AI chat panel

Studio includes a chat panel (toggled via toolbar button or `Ctrl+/`) where users interact with Kitsy Mind:

```
┌────────────────────────────────┐
│  AI Assistant                   │
│                                │
│  User: Add a pricing section   │
│         with 3 plans           │
│                                │
│  Mind: I'll add a pricing      │
│  section with 3 plans below    │
│  the features section.         │
│  [Preview Change]              │
│  [Apply] [Modify] [Cancel]     │
│                                │
│  User: Make the middle plan    │
│         highlighted            │
│                                │
│  Mind: Done — the "Pro" plan   │
│  is now highlighted.           │
│  [Applied ✓]                   │
│                                │
│  [Type a message...]           │
└────────────────────────────────┘
```

### 19.2 AI → Studio edit flow

```
1. User types prompt in AI chat
2. Studio sends: ask("ai:edit-section", { 
     prompt, 
     currentConfig,           // Full context
     selectedNodeId,          // What's currently selected
     availableComponents,     // Component catalog
     themeTokens              // Current theme
   })
3. Kitsy Mind generates a config patch
4. Studio shows preview of the change (split view: before/after)
5. User clicks "Apply" → Studio applies patch via replaceSubtree operation
6. User clicks "Modify" → continues conversation with more instructions
7. User clicks "Cancel" → patch discarded
```

### 19.3 Context-aware AI

Mind receives the full current config + selection context, so it can:

- Insert new sections relative to existing content
- Modify selected components specifically
- Respect the current theme when choosing colors/styles
- Use existing data sources when wiring new components

---

## 20. Implementation Sequence

### 20.1 Sprint plan (2-week sprints)

| Sprint | Deliverables |
|--------|-------------|
| **S1** | `@kitsy/canvas`: ViewNodeTree, traverse, insert/remove/move/update operations, constraint validation |
| **S2** | `@kitsy/canvas`: undo stack, clipboard, diff (tree → JSON Patch), ID generation |
| **S3** | Studio shell: layout (toolbar + left + workspace + right panels), StudioContext, device toggle |
| **S4** | Component palette: reads from registry, category grouping, search, drag source |
| **S5** | Canvas editor: ViewNode rendering with selection overlays, click-to-select, breadcrumb bar |
| **S6** | Property panel: auto-generation from propSchema, all field renderers (string, number, boolean, select, color, image) |
| **S7** | Live preview: iframe setup, PostMessage bridge, config push, node click ↔ selection sync |
| **S8** | Drag-and-drop: palette → canvas, canvas reorder, tree reorder, drop zone computation with constraints |
| **S9** | Data tab: data source list, data source editor (REST + Static adapters), data binding UI, data preview |
| **S10** | Actions tab: action builder modal, all action types (navigate, bus, mutate, state, sequence) |
| **S11** | Theme editor: color picker + scale generation, typography editor, spacing/radius controls, live preview injection |
| **S12** | Multi-view: page list, page CRUD, navigation config editor, page settings |
| **S13** | Responsive editing: device toggle ↔ preview, breakpoint-specific prop editing, responsive badges |
| **S14** | Template browser: template list, preview, apply, save-as-template, section template drag |
| **S15** | Undo/redo: full undo stack with batching, keyboard shortcuts, undo label display |
| **S16** | Server sync: auto-save via sync protocol, offline queue, status indicator, conflict handling |
| **S17** | Mind integration: AI chat panel, ask/answer flow, preview-before-apply, modify loop |
| **S18** | Collaboration: presence indicators, cursor sharing, real-time sync of edits |
| **S19** | Polish: keyboard shortcuts, accessibility audit, error handling, loading states, empty states |
| **S20** | Testing: E2E tests for all edit operations, integration tests with server, performance profiling |

### 20.2 Dependencies

| Dependency | Required From | Required By Sprint |
|-----------|--------------|-------------------|
| `@kitsy/blu-schema` (JSON Schema) | Blu Phase 0 | S1 |
| `@kitsy/blu-validate` | Blu Phase 1 | S1 |
| Component registry + ComponentMeta | Blu Phase 0 | S4 |
| `@kitsy/blu-shell` (render in iframe) | Blu Phase 0 | S7 |
| `@kitsy/blu-data` (data sources) | Blu Phase 1 | S9 |
| `@kitsy/server` (sync protocol) | Server Phase 2 | S16 |
| `@kitsy/mind` (AI agent) | Mind Phase 4 | S17 |

**Parallelization:** S1-S15 can be built entirely against local/in-memory config without Kitsy Server. Server sync (S16) and Mind integration (S17) are late additions that require those tracks to be ready.
