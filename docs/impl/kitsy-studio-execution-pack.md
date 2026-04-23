# Kitsy Studio — Execution Pack

**Track:** E1 (Studio)  
**Phase:** 4 (INACTIVE — do not begin until Phase 2 gate is met)  
**Owner:** TBD + Codex agents  
**Repo:** `github.com/kitsy-ai/kitsy` → `packages/studio/`, `packages/canvas/`  
**Spec Document:** Studio Implementation Spec  
**License:** Proprietary

---

## Start Condition

> **DO NOT BEGIN THIS TRACK** until ALL of the following are true:
>
> 1. Phase 2 gate met (Server operational — config store, sync, publish all working)
> 2. `@kitsy/blu-validate` published and functional (Blu Sprint 1)
> 3. `@kitsy/blu-schema` published with full ViewNode + ComponentMeta schemas (Blu Sprint 1)
> 4. Component registry populated with ComponentMeta for all 49 components (Component Spec)
> 5. Platform shell running with Blu module site management (Platform B3-B4)
>
> **If any of these are not met, this document is for REFERENCE ONLY.**

---

## Scope Rule

> **This track builds @kitsy/canvas (pure logic, no UI) and @kitsy/studio (visual editor). It does NOT build AI features (that's the Mind track), collaboration (that's a later Studio sprint after Mind), or platform hosting features.**

---

## 1. Sprint Plan

### Sprint E1-S1 — Canvas Core (Weeks 17-18)

**Objective:** Create `@kitsy/canvas` — pure ViewNode tree manipulation and constraint validation.

**Ref:** Studio Spec §3.2 (Canvas Package), §4 (Canvas Model)

| # | Task |
|---|------|
| 1 | Create `packages/canvas/` — zero UI dependencies, pure TypeScript |
| 2 | Implement `ViewNodeTree`: immutable tree structure from ApplicationConfiguration |
| 3 | Implement tree traversal: walk, find, filter, map, getPath (parent chain), getChildren |
| 4 | Implement operations as pure functions (old config → new config): `insertNode(config, parentId, position, node)`, `removeNode(config, nodeId)`, `moveNode(config, nodeId, newParentId, newPosition)`, `updateProps(config, nodeId, props)`, `updateStyle(config, nodeId, style)`, `updateData(config, nodeId, data)`, `updateActions(config, nodeId, event, action)`, `wrapNode(config, nodeId, wrapperUrn)`, `unwrapNode(config, nodeId)`, `duplicateNode(config, nodeId)`, `replaceSubtree(config, nodeId, newTree)` |
| 5 | Implement constraint validation: `validatePlacement(parentUrn, childUrn, registry)` → checks allowedChildren, allowedParents, maxChildren, slots |
| 6 | Implement `UndoStack`: push config snapshot, undo → return previous, redo → return next, max 100 entries |
| 7 | Implement clipboard: copy (serialize selection), paste (deserialize with new IDs) |
| 8 | Implement tree → JSON Patch diff (old config → new config → RFC 6902 patches) |
| 9 | Implement deterministic ID generation for new nodes (nanoid or similar) |

**Exit criteria:**
- [ ] `@kitsy/canvas` published (or ready in monorepo)
- [ ] All 11 tree operations work correctly
- [ ] Constraint validation rejects invalid placements
- [ ] Undo/redo with 100-entry stack works
- [ ] Copy/paste produces new IDs
- [ ] JSON Patch diff correct for all operations
- [ ] Package has ZERO UI dependencies — runs in Node.js
- [ ] 95%+ test coverage (pure logic = easy to test)

**DO NOT:** Build any React UI. Canvas is pure logic. Studio UI is next sprint.

---

### Sprint E1-S2 — Studio Shell & Palette (Weeks 19-20)

**Objective:** Studio layout, component palette, and basic canvas rendering.

**Ref:** Studio Spec §2 (Architecture), §5 (Palette)

| # | Task |
|---|------|
| 1 | Create `packages/studio/` — Blu app using `@kitsy/blu-shell` |
| 2 | Build Studio layout: toolbar (top) + left panel + workspace (center) + right panel |
| 3 | Build component palette (left panel): reads from ComponentRegistry.getAllMeta(), groups by category, search across displayName + tags |
| 4 | Palette items: show thumbnail, displayName, category badge, draggable |
| 5 | Build canvas editor (center): renders ViewNode tree with selectable wrappers around each node |
| 6 | Click node in canvas → select it (blue border + selection overlay) |
| 7 | Breadcrumb bar above canvas: shows path to selected node |
| 8 | StudioContext: holds current config, selected node ID, editing mode |
| 9 | Wire BuilderStateManager: every edit dispatches bus command → canvas operation → new config → undo stack push |

**Exit criteria:**
- [ ] Studio loads with full layout (toolbar + panels + workspace)
- [ ] Palette shows all 49 components grouped by category
- [ ] Palette search works
- [ ] Canvas renders ViewNode tree from current config
- [ ] Click to select works with visual overlay
- [ ] Breadcrumb shows node path

---

### Sprint E1-S3 — Live Preview & Property Panel (Weeks 21-22)

**Ref:** Studio Spec §6 (Property Panel), §7 (Preview)

| # | Task |
|---|------|
| 1 | Live preview iframe: loads a real Blu app from current config via PostMessage bridge |
| 2 | Config updates sent to preview via postMessage (full or incremental patch) |
| 3 | Click node in preview → sends node ID back to Studio → selects in canvas |
| 4 | Device toggle: desktop/tablet/mobile presets resize the iframe |
| 5 | Property panel (right panel): auto-generated from selected node's ComponentMeta.propSchema |
| 6 | Field renderers: StringField, NumberField, BooleanField, SelectField, ColorField, ImageField, SpacingField, JSONField |
| 7 | Prop changes → `updateProps` canvas operation → config updates → preview re-renders |

**Exit criteria:**
- [ ] Preview iframe renders the actual Blu app from config
- [ ] Click in preview selects in Studio
- [ ] Device toggle resizes preview correctly
- [ ] Property panel auto-generates fields from propSchema
- [ ] Editing a prop updates the preview in real-time

---

### Sprint E1-S4 — Drag-Drop, Data, Actions (Weeks 23-24)

**Ref:** Studio Spec §8 (DnD), §11 (Data), §12 (Actions)

| # | Task |
|---|------|
| 1 | Drag from palette to canvas: constraint-validated drop zones, insert node on drop |
| 2 | Drag in canvas: reorder siblings, reparent nodes |
| 3 | Drag in component tree (left panel outline): reorder and reparent |
| 4 | Data tab in property panel: data source selector, mapping editor, loading/error/empty state config |
| 5 | Actions tab in property panel: event selector, action builder modal (all 6 action types) |
| 6 | Component tree outline (left panel below palette): hierarchical node list with drag handles |

**Exit criteria:**
- [ ] Drag-drop from palette to canvas works with constraint enforcement
- [ ] Invalid placements show no drop zone
- [ ] Reorder and reparent via drag in canvas and tree
- [ ] Data binding configurable from property panel
- [ ] Actions wired from property panel with builder modal
- [ ] All 6 action types configurable via UI

---

### Sprint E1-S5 — Theme, Responsive, Pages, Undo (Weeks 25-26)

**Ref:** Studio Spec §13 (Theme), §14 (Responsive), §10 (Pages), §9 (Undo)

| # | Task |
|---|------|
| 1 | Theme editor (left panel tab): color picker with scale generation, typography editor, spacing/radius controls |
| 2 | Theme changes apply to preview in real-time (CssBuilder token injection) |
| 3 | Responsive editing: device toggle switches breakpoint context, responsive tab in property panel for per-breakpoint overrides |
| 4 | Page management (left panel tab): page list, create/delete/rename page, set home page, page settings |
| 5 | Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z), toolbar buttons, undo label display |
| 6 | Undo batching: rapid changes (typing, slider drag) collapse into single undo entry (500ms debounce) |
| 7 | All other keyboard shortcuts from Studio Spec §17 |

**Exit criteria:**
- [ ] Theme token editing with live preview
- [ ] Color scale auto-generation from primary color
- [ ] Responsive overrides per breakpoint
- [ ] Page CRUD and navigation config
- [ ] Undo/redo working with batching
- [ ] Keyboard shortcuts functional

---

### Sprint E1-S6 — Server Sync & Templates (Weeks 27-28)

**Ref:** Studio Spec §18 (Server Sync), §15 (Templates)

| # | Task |
|---|------|
| 1 | Auto-save to Kitsy Server: config changes → debounced (500ms) → `sync:config:propose` |
| 2 | Sync status indicator: "Saved ✓" / "Saving..." / "Offline" |
| 3 | Offline support: edits continue locally, queue replays on reconnect |
| 4 | Conflict handling: if server rejects patch, show error and revert |
| 5 | Template browser (left panel tab): built-in site + section templates |
| 6 | Apply template: select → preview → apply (replaceSubtree or new site config) |
| 7 | Save as template: select nodes → save as reusable section template |

**Exit criteria:**
- [ ] Auto-save to server with sync status indicator
- [ ] Offline editing works, reconnect syncs
- [ ] Template browser with preview and apply
- [ ] Save selection as template

---

### Sprint E1-S7 — Polish & Platform Integration (Weeks 29-30)

| # | Task |
|---|------|
| 1 | Embed Studio in platform at `/blu/site/:id/studio` (replaces JSON editor from B4) |
| 2 | "Back to Dashboard" navigation from Studio |
| 3 | Publish button in Studio toolbar → calls server publish pipeline |
| 4 | Error handling: error boundaries on all panels, user-friendly error messages |
| 5 | Loading states: skeleton screens during config load, preview loading |
| 6 | Empty states: empty canvas, empty palette search results, no pages |
| 7 | Accessibility audit: keyboard navigation, screen reader support, focus management |
| 8 | Performance: measure and optimize config compiler, preview update latency |

**Exit criteria:**
- [ ] Studio accessible from platform dashboard
- [ ] Publish from Studio works
- [ ] Error handling covers all failure modes
- [ ] Keyboard navigation through all panels
- [ ] Preview updates in < 200ms after prop change

---

## 2. Phase 4 Gate (Studio)

- [ ] `@kitsy/canvas` operational (all operations, constraints, undo, clipboard)
- [ ] Studio renders in platform dashboard
- [ ] Full WYSIWYG editing: select, drag, edit props, bind data, wire actions
- [ ] Live preview with device toggle
- [ ] Theme editing with live preview
- [ ] Responsive editing per breakpoint
- [ ] Page management
- [ ] Server sync with offline support
- [ ] Template browser and apply
- [ ] Publish from Studio

---

## 3. Track Governance

```
@kitsy/canvas:
  - ZERO UI dependencies (pure TypeScript logic)
  - All operations are pure functions: (oldConfig) → newConfig
  - Must work in Node.js (used by Mind track and CLI)
  - 95%+ test coverage

@kitsy/studio:
  - Built with @kitsy/blu-shell (eating our own cooking)
  - Property panel auto-generated from propSchema (no manual UI per component)
  - Every edit is a bus command → canvas operation → config update
  - Preview is a real Blu app in an iframe, not a mock
```

```
DEPENDENCY RULES:
  @kitsy/canvas → @kitsy/blu-schema (types only)
  @kitsy/studio → @kitsy/blu-shell, @kitsy/blu-bus, @kitsy/canvas, @kitsy/blu-sync
  @kitsy/studio → does NOT import @kitsy/mind (AI chat is added later via Mind track)
```
