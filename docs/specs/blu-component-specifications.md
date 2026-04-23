# Blu Component Specifications

**Status:** Canonical
**Scope:** Complete specification for every component URN in the Blu registry — primitives, UI elements, layout, blocks, forms, and templates.
**Read first:** `docs/blu/foundation.md`, `docs/blu/architecture.md`, `docs/blu/specification.md` (particularly §11 ViewNode, §13 Forms, §15 Component Registry and URNs).

---

## Table of Contents

1. [Component Model](#1-component-model)
2. [URN Naming Convention](#2-urn-naming-convention)
3. [Core Primitives (`blu-core`)](#3-core-primitives-blu-core)
4. [Layout Components (`blu-grid`)](#4-layout-components-blu-grid)
5. [UI Components (`blu-ui`)](#5-ui-components-blu-ui)
6. [Block Components (`blu-blocks`)](#6-block-components-blu-blocks)
7. [Form Components (`blu-blocks` / forms)](#7-form-components)
8. [Icon System (`blu-icons`)](#8-icon-system-blu-icons)
9. [Template Specifications (`blu-templates`)](#9-template-specifications-blu-templates)
10. [Component Lifecycle & Hooks](#10-component-lifecycle--hooks)
11. [Theming Contract](#11-theming-contract)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [Responsive Behavior](#13-responsive-behavior)
14. [Custom Component Authoring Guide](#14-custom-component-authoring-guide)
15. [AI Generation Rules](#15-ai-generation-rules)

---

## 1. Component Model

Every Blu component is registered in the `ComponentRegistry` with a unique URN, a React implementation, and a metadata descriptor (`ComponentMeta`). The metadata serves three audiences:

1. **Developers** — TypeScript prop types, documentation, usage examples
2. **Kitsy Studio** — palette display, property panel generation, drag-and-drop constraints
3. **Kitsy Mind (AI)** — prop schema for constrained generation, category for intent matching

### 1.1 ComponentMeta (canonical)

```typescript
interface ComponentMeta {
  urn: string;                          // Unique identifier: "urn:blu:core:text"
  displayName: string;                  // Human-readable: "Text"
  description: string;                  // Short description for palette/AI
  category: ComponentCategory;
  tags: string[];                       // Searchable: ["typography", "inline", "content"]
  thumbnail?: string;                   // URL or inline SVG for palette display
  version: string;                      // Semver, tracks breaking prop changes

  // Props
  propSchema: JSONSchema;               // Full JSON Schema for all props
  defaultProps: Record<string, unknown>;// Defaults applied when AI/Studio creates instance
  requiredProps: string[];              // Props that MUST be provided

  // Slots (named content areas)
  slots: SlotDefinition[];

  // Constraints
  constraints?: {
    allowedParents?: string[];          // URNs of valid parent components
    allowedChildren?: string[];         // URNs of valid child components
    maxChildren?: number;
    minChildren?: number;
    standalone?: boolean;               // Can be root-level ViewNode?
  };

  // Responsive
  responsiveProps?: string[];           // Props that support per-breakpoint overrides

  // Accessibility
  a11y?: {
    role?: string;                      // ARIA role
    requiredLabels?: string[];          // Props that serve as accessible labels
    focusable?: boolean;
    keyboardInteraction?: string;       // Description of keyboard behavior
  };
}

interface SlotDefinition {
  name: string;                         // "default", "header", "footer", "actions"
  displayName: string;                  // "Content", "Header Area"
  description: string;
  allowedComponents?: string[];         // URN filter for what can go in this slot
  maxItems?: number;
  required?: boolean;
}

type ComponentCategory =
  | "primitive"        // Box, Text, Image — raw building blocks
  | "layout"           // Stack, Grid, Container, Section, Divider
  | "navigation"       // NavBar, Tabs, Breadcrumb, Sidebar, Link
  | "input"            // Button, TextField, Select, Checkbox, etc.
  | "display"          // Card, Badge, Avatar, Tag, Tooltip, Table
  | "feedback"         // Alert, Toast, Modal, Drawer, Spinner, Progress
  | "media"            // Image, Video, Icon, Carousel
  | "marketing"        // Hero, CTA, Feature, Testimonial, Pricing
  | "data"             // List, DataTable, Chart, Stat
  | "form"             // Form, FormField (Section 7)
  | "template"         // Full page templates
  | "custom";          // User/plugin registered
```

### 1.2 Registration

```typescript
// Developer registration (code-first)
import { Hero } from "./components/Hero";
registry.register("urn:blu:block:hero", Hero, heroMeta);

// Plugin registration (scoped)
pluginContext.registerComponent("urn:plugin:analytics:heatmap", Heatmap, heatmapMeta);

// Registry query
registry.get("urn:blu:block:hero");           // → { component, meta }
registry.getByCategory("marketing");          // → ComponentMeta[]
registry.search("hero banner");               // → ComponentMeta[] (fuzzy on displayName + tags)
registry.has("urn:blu:block:hero");           // → boolean
registry.getAllMeta();                         // → ComponentMeta[] (for AI/Studio catalog)
```

---

## 2. URN Naming Convention

```
urn:blu:<package>:<component>

Examples:
  urn:blu:core:box              — from @kitsy/blu-core
  urn:blu:core:text             — from @kitsy/blu-core
  urn:blu:ui:button             — from @kitsy/blu-ui
  urn:blu:ui:card               — from @kitsy/blu-ui
  urn:blu:grid:stack            — from @kitsy/blu-grid
  urn:blu:grid:columns          — from @kitsy/blu-grid
  urn:blu:block:hero            — from @kitsy/blu-blocks
  urn:blu:block:form            — from @kitsy/blu-blocks
  urn:blu:icon:<name>           — from @kitsy/blu-icons
  urn:blu:template:landing      — from @kitsy/blu-templates

Plugin components:
  urn:plugin:<plugin-name>:<component>

Reserved namespaces:
  urn:blu:*                     — framework components only
  urn:kitsy:*                   — proprietary Kitsy platform components
  urn:plugin:*                  — third-party plugins
```

---

## 3. Core Primitives (`blu-core`)

These are the lowest-level building blocks. Everything else is composed from these.

### 3.1 `urn:blu:core:box`

The universal container. Equivalent to a `<div>` with no semantic meaning.

```typescript
interface BoxProps {
  // Layout
  display?: "block" | "inline" | "inline-block" | "flex" | "inline-flex" | "grid" | "none";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  alignItems?: "start" | "center" | "end" | "stretch" | "baseline";
  justifyContent?: "start" | "center" | "end" | "between" | "around" | "evenly";
  gap?: SpacingValue;
  wrap?: boolean;

  // Spacing
  padding?: SpacingValue | SpacingObject;
  margin?: SpacingValue | SpacingObject;

  // Sizing
  width?: SizeValue;
  height?: SizeValue;
  minWidth?: SizeValue;
  maxWidth?: SizeValue;
  minHeight?: SizeValue;
  maxHeight?: SizeValue;

  // Visual
  background?: ColorValue;
  borderRadius?: RadiusValue;
  border?: BorderValue;
  shadow?: ShadowValue;
  opacity?: number;                    // 0–1
  overflow?: "visible" | "hidden" | "scroll" | "auto";

  // Positioning
  position?: "static" | "relative" | "absolute" | "fixed" | "sticky";
  top?: SizeValue;
  right?: SizeValue;
  bottom?: SizeValue;
  left?: SizeValue;
  zIndex?: number;

  // Interaction
  cursor?: string;
}

// Meta
const boxMeta: ComponentMeta = {
  urn: "urn:blu:core:box",
  displayName: "Box",
  description: "Universal container element for layout and grouping",
  category: "primitive",
  tags: ["container", "div", "wrapper", "layout"],
  version: "1.0.0",
  slots: [{ name: "default", displayName: "Content", description: "Child elements" }],
  constraints: { standalone: true },
  responsiveProps: ["display", "flexDirection", "padding", "margin", "width", "gap"],
  propSchema: { /* full JSON Schema */ },
  defaultProps: { display: "block" },
  requiredProps: [],
};
```

### 3.2 `urn:blu:core:text`

Inline text with typography control.

```typescript
interface TextProps {
  content: string;                      // The text to display
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "label" | "small" | "strong" | "em";
  
  // Typography
  size?: TypographySize;               // "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl"
  weight?: "thin" | "light" | "normal" | "medium" | "semibold" | "bold" | "extrabold";
  align?: "left" | "center" | "right" | "justify";
  color?: ColorValue;
  lineHeight?: number | string;
  letterSpacing?: string;
  decoration?: "none" | "underline" | "line-through";
  transform?: "none" | "uppercase" | "lowercase" | "capitalize";
  truncate?: boolean;                  // Ellipsis overflow
  maxLines?: number;                   // Line clamp
  
  // i18n
  i18nKey?: string;                    // Key for internationalization lookup
}

const textMeta: ComponentMeta = {
  urn: "urn:blu:core:text",
  displayName: "Text",
  description: "Typography element for displaying text content",
  category: "primitive",
  tags: ["typography", "text", "heading", "paragraph", "content"],
  version: "1.0.0",
  slots: [],
  constraints: { maxChildren: 0 },     // Text is a leaf node
  responsiveProps: ["size", "align", "maxLines"],
  a11y: { requiredLabels: ["content"] },
  propSchema: { /* ... */ },
  defaultProps: { as: "span", size: "base", weight: "normal" },
  requiredProps: ["content"],
};
```

### 3.3 `urn:blu:core:image`

```typescript
interface ImageProps {
  src: string;                          // URL or asset reference
  alt: string;                          // Required for accessibility
  width?: SizeValue;
  height?: SizeValue;
  fit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  position?: string;                    // object-position
  loading?: "lazy" | "eager";
  borderRadius?: RadiusValue;
  fallback?: string;                    // Fallback image URL
  caption?: string;
  aspectRatio?: string;                 // "16/9", "4/3", "1/1"
}

const imageMeta: ComponentMeta = {
  urn: "urn:blu:core:image",
  displayName: "Image",
  description: "Responsive image with alt text, aspect ratio, and lazy loading",
  category: "media",
  tags: ["image", "photo", "picture", "media", "visual"],
  version: "1.0.0",
  slots: [],
  constraints: { maxChildren: 0 },
  responsiveProps: ["width", "height", "aspectRatio"],
  a11y: { role: "img", requiredLabels: ["alt"] },
  propSchema: { /* ... */ },
  defaultProps: { loading: "lazy", fit: "cover" },
  requiredProps: ["src", "alt"],
};
```

### 3.4 `urn:blu:core:link`

```typescript
interface LinkProps {
  href: string;
  label?: string;                       // Text content (or use children slot)
  target?: "_self" | "_blank";
  rel?: string;
  variant?: "default" | "subtle" | "nav" | "button";
  color?: ColorValue;
  underline?: "always" | "hover" | "none";
  external?: boolean;                   // Auto-adds target="_blank" rel="noopener"

  // If internal (within Blu app), use NavigateAction instead of href
  navigate?: { path: string; params?: Record<string, unknown> };
}
```

### 3.5 `urn:blu:core:spacer`

```typescript
interface SpacerProps {
  size?: SpacingValue;                  // Fixed space
  flex?: number;                        // Flex grow (fills available space)
  axis?: "horizontal" | "vertical";
}
```

---

## 4. Layout Components (`blu-grid`)

### 4.1 `urn:blu:grid:stack`

Vertical or horizontal stack with consistent spacing.

```typescript
interface StackProps {
  direction?: "vertical" | "horizontal";
  gap?: SpacingValue;                   // "xs" | "sm" | "md" | "lg" | "xl" | number
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
  wrap?: boolean;
  reverse?: boolean;
  divider?: boolean;                    // Show divider between items
  padding?: SpacingValue | SpacingObject;
}

const stackMeta: ComponentMeta = {
  urn: "urn:blu:grid:stack",
  displayName: "Stack",
  description: "Arrange children vertically or horizontally with consistent spacing",
  category: "layout",
  tags: ["stack", "flex", "column", "row", "layout", "spacing"],
  version: "1.0.0",
  slots: [{ name: "default", displayName: "Items", description: "Stack children" }],
  constraints: { standalone: true, minChildren: 1 },
  responsiveProps: ["direction", "gap", "align", "justify"],
  defaultProps: { direction: "vertical", gap: "md", align: "stretch" },
  requiredProps: [],
};
```

### 4.2 `urn:blu:grid:columns`

Multi-column responsive grid.

```typescript
interface ColumnsProps {
  columns?: number | "auto";            // Fixed count or auto-fit
  gap?: SpacingValue;
  minColumnWidth?: SizeValue;           // For auto-fit: min width per column
  align?: "start" | "center" | "end" | "stretch";

  // Responsive breakpoint overrides
  // e.g., { sm: 1, md: 2, lg: 3 }
  responsive?: Record<BreakpointKey, number>;
}

const columnsMeta: ComponentMeta = {
  urn: "urn:blu:grid:columns",
  displayName: "Columns",
  description: "Responsive multi-column grid layout",
  category: "layout",
  tags: ["grid", "columns", "multi-column", "layout", "responsive"],
  version: "1.0.0",
  slots: [{ name: "default", displayName: "Column Items", description: "Grid children" }],
  constraints: { standalone: true, minChildren: 1 },
  responsiveProps: ["columns", "gap"],
  defaultProps: { columns: 2, gap: "md" },
  requiredProps: [],
};
```

### 4.3 `urn:blu:grid:container`

Centered, max-width constrained content container.

```typescript
interface ContainerProps {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full" | SizeValue;
  padding?: SpacingValue;
  center?: boolean;                     // Horizontal centering (default: true)
}

// maxWidth defaults: sm=640px, md=768px, lg=1024px, xl=1280px, 2xl=1536px
```

### 4.4 `urn:blu:grid:section`

Full-width page section with background and padding.

```typescript
interface SectionProps {
  background?: ColorValue | GradientValue;
  backgroundImage?: string;
  padding?: SpacingValue;
  paddingY?: SpacingValue;              // Vertical padding (common for sections)
  minHeight?: SizeValue;
  id?: string;                          // For anchor links
  fullBleed?: boolean;                  // Content extends to edges
}
```

### 4.5 `urn:blu:grid:divider`

```typescript
interface DividerProps {
  orientation?: "horizontal" | "vertical";
  color?: ColorValue;
  thickness?: number;                   // px
  spacing?: SpacingValue;              // Margin around divider
  label?: string;                       // Text in center of divider
}
```

### 4.6 `urn:blu:grid:aspect-ratio`

```typescript
interface AspectRatioProps {
  ratio: string;                        // "16/9", "4/3", "1/1", "21/9"
}
```

---

## 5. UI Components (`blu-ui`)

### 5.1 `urn:blu:ui:button`

```typescript
interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  icon?: string;                        // Icon URN or name
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";

  // Action is defined in ViewNode.actions.onClick, NOT here
  // Button is purely presentational
}

const buttonMeta: ComponentMeta = {
  urn: "urn:blu:ui:button",
  displayName: "Button",
  description: "Interactive button with variants, sizes, icons, and loading state",
  category: "input",
  tags: ["button", "action", "click", "submit", "cta"],
  version: "1.0.0",
  slots: [],
  constraints: { maxChildren: 0 },
  a11y: { role: "button", focusable: true, requiredLabels: ["label"], keyboardInteraction: "Enter or Space to activate" },
  defaultProps: { variant: "primary", size: "md", type: "button" },
  requiredProps: ["label"],
};
```

### 5.2 `urn:blu:ui:card`

```typescript
interface CardProps {
  variant?: "elevated" | "outlined" | "filled" | "ghost";
  padding?: SpacingValue;
  borderRadius?: RadiusValue;
  clickable?: boolean;                  // Adds hover effect + cursor pointer
  selected?: boolean;
  fullWidth?: boolean;
}

const cardMeta: ComponentMeta = {
  urn: "urn:blu:ui:card",
  displayName: "Card",
  description: "Versatile container for grouped content with elevation or border",
  category: "display",
  tags: ["card", "container", "panel", "tile", "surface"],
  version: "1.0.0",
  slots: [
    { name: "default", displayName: "Content", description: "Card body" },
    { name: "header", displayName: "Header", description: "Optional card header" },
    { name: "footer", displayName: "Footer", description: "Optional card footer" },
    { name: "media", displayName: "Media", description: "Image/video at top of card", maxItems: 1 },
  ],
  defaultProps: { variant: "elevated", padding: "md" },
  requiredProps: [],
};
```

### 5.3 `urn:blu:ui:badge`

```typescript
interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
  size?: "sm" | "md" | "lg";
  dot?: boolean;                        // Show dot instead of label
  icon?: string;
  removable?: boolean;                  // Show X to remove
}
```

### 5.4 `urn:blu:ui:avatar`

```typescript
interface AvatarProps {
  src?: string;                         // Image URL
  name?: string;                        // Fallback: initials from name
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  status?: "online" | "offline" | "away" | "busy";
  fallbackColor?: ColorValue;
}
```

### 5.5 `urn:blu:ui:alert`

```typescript
interface AlertProps {
  title?: string;
  message: string;
  variant?: "info" | "success" | "warning" | "error";
  icon?: string | boolean;              // true = auto-icon based on variant
  dismissible?: boolean;
  bordered?: boolean;
}
```

### 5.6 `urn:blu:ui:modal`

```typescript
interface ModalProps {
  open: boolean;                        // Controlled via state binding
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  preventScroll?: boolean;
}

// Slots: default (body), header, footer, actions
```

### 5.7 `urn:blu:ui:tabs`

```typescript
interface TabsProps {
  tabs: TabItem[];
  activeTab?: string;                   // Controlled via state or action
  variant?: "line" | "enclosed" | "pill";
  size?: "sm" | "md" | "lg";
  orientation?: "horizontal" | "vertical";
  fullWidth?: boolean;
}

interface TabItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  badge?: string;                       // Count or label
}

// Each tab's content is a child ViewNode with slot={tabId}
```

### 5.8 `urn:blu:ui:table`

```typescript
interface TableProps {
  columns: TableColumn[];
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  sortable?: boolean;                   // Enable column sorting
  selectable?: boolean;                 // Enable row selection

  // Data comes from ViewNode.data or ViewNode.repeat, not props
}

interface TableColumn {
  id: string;                           // Maps to data field
  header: string;                       // Display header
  width?: SizeValue;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: string;                      // Named renderer from registry (e.g., "currency", "date", "badge")
}
```

### 5.9 Additional UI components (specs follow same pattern)

| URN | Display Name | Category | Key Props |
|-----|-------------|----------|-----------|
| `urn:blu:ui:tooltip` | Tooltip | feedback | `content, placement, trigger` |
| `urn:blu:ui:drawer` | Drawer | feedback | `open, position, size, overlay` |
| `urn:blu:ui:spinner` | Spinner | feedback | `size, color, label` |
| `urn:blu:ui:progress` | Progress Bar | feedback | `value, max, variant, showLabel` |
| `urn:blu:ui:skeleton` | Skeleton | feedback | `width, height, variant(text\|circle\|rect)` |
| `urn:blu:ui:breadcrumb` | Breadcrumb | navigation | `items: {label, path}[]` |
| `urn:blu:ui:pagination` | Pagination | navigation | `total, pageSize, currentPage` |
| `urn:blu:ui:tag` | Tag | display | `label, variant, removable, icon` |
| `urn:blu:ui:accordion` | Accordion | display | `items: {title, content}[], multiple` |
| `urn:blu:ui:toast` | Toast | feedback | `message, variant, duration, position` |

---

## 6. Block Components (`blu-blocks`)

Blocks are higher-level compositions — pre-assembled ViewNode patterns that serve common business needs. Each block is a self-contained section with opinionated structure.

### 6.1 `urn:blu:block:hero`

```typescript
interface HeroProps {
  // Content
  headline: string;
  subheadline?: string;
  description?: string;

  // Visual
  backgroundImage?: string;
  backgroundOverlay?: ColorValue;       // Semi-transparent overlay on image
  backgroundColor?: ColorValue;
  alignment?: "left" | "center" | "right";
  height?: "sm" | "md" | "lg" | "full"; // sm=40vh, md=60vh, lg=80vh, full=100vh
  textColor?: ColorValue;

  // CTA
  primaryCTA?: { label: string };       // Action wired via ViewNode.actions
  secondaryCTA?: { label: string };

  // Media
  image?: { src: string; alt: string; position?: "left" | "right" | "background" };
  video?: { src: string; autoplay?: boolean; muted?: boolean };
}

const heroMeta: ComponentMeta = {
  urn: "urn:blu:block:hero",
  displayName: "Hero Banner",
  description: "Full-width hero section with headline, description, CTA buttons, and optional background image or video",
  category: "marketing",
  tags: ["hero", "banner", "header", "landing", "cta", "above-the-fold"],
  version: "1.0.0",
  slots: [
    { name: "media", displayName: "Media", description: "Image or video", maxItems: 1 },
    { name: "actions", displayName: "CTA Buttons", description: "Call-to-action buttons" },
  ],
  constraints: { standalone: true },
  responsiveProps: ["height", "alignment"],
  defaultProps: { alignment: "center", height: "md" },
  requiredProps: ["headline"],
};
```

**Example ViewNode (what AI generates):**

```json
{
  "id": "hero-1",
  "componentUrn": "urn:blu:block:hero",
  "props": {
    "headline": "Fresh Bread, Baked Daily",
    "subheadline": "Artisan bakery since 2019",
    "description": "We source local ingredients to create handcrafted sourdough, pastries, and specialty breads.",
    "backgroundImage": "/images/bakery-hero.jpg",
    "backgroundOverlay": "rgba(0,0,0,0.4)",
    "textColor": "#ffffff",
    "alignment": "center",
    "height": "lg",
    "primaryCTA": { "label": "Order Online" },
    "secondaryCTA": { "label": "View Menu" }
  },
  "actions": {
    "onClick": { "type": "navigate", "path": "/order" }
  }
}
```

### 6.2 `urn:blu:block:features`

```typescript
interface FeaturesProps {
  headline?: string;
  subheadline?: string;
  features: FeatureItem[];
  layout?: "grid" | "alternating" | "list";
  columns?: 2 | 3 | 4;
  iconStyle?: "circle" | "square" | "none";
}

interface FeatureItem {
  icon?: string;                        // Icon name or URN
  title: string;
  description: string;
  image?: { src: string; alt: string };
  link?: { label: string; path: string };
}
```

### 6.3 `urn:blu:block:pricing`

```typescript
interface PricingProps {
  headline?: string;
  subheadline?: string;
  plans: PricingPlan[];
  billingToggle?: boolean;              // Monthly/yearly toggle
  currency?: string;
}

interface PricingPlan {
  name: string;
  description?: string;
  price: { monthly: number; yearly?: number };
  features: string[];
  highlighted?: boolean;                // "Most popular" badge
  ctaLabel: string;
  ctaVariant?: "primary" | "secondary" | "outline";
}
```

### 6.4 `urn:blu:block:testimonials`

```typescript
interface TestimonialsProps {
  headline?: string;
  testimonials: TestimonialItem[];
  layout?: "carousel" | "grid" | "stack";
  autoplay?: boolean;
  interval?: number;                    // ms for carousel
}

interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: string;
  rating?: number;                      // 1-5 stars
}
```

### 6.5 `urn:blu:block:cta`

```typescript
interface CTAProps {
  headline: string;
  description?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  alignment?: "left" | "center";
  background?: ColorValue | GradientValue;
  compact?: boolean;
}
```

### 6.6 `urn:blu:block:faq`

```typescript
interface FAQProps {
  headline?: string;
  items: FAQItem[];
  layout?: "accordion" | "grid" | "list";
  columns?: 1 | 2;
  expandMultiple?: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}
```

### 6.7 `urn:blu:block:footer`

```typescript
interface FooterProps {
  brand?: { name: string; logo?: string; tagline?: string };
  columns: FooterColumn[];
  copyright?: string;
  socialLinks?: SocialLink[];
  background?: ColorValue;
  compact?: boolean;
}

interface FooterColumn {
  title: string;
  links: { label: string; href?: string; path?: string }[];
}

interface SocialLink {
  platform: "twitter" | "facebook" | "instagram" | "linkedin" | "youtube" | "github" | "tiktok";
  url: string;
}
```

### 6.8 `urn:blu:block:navbar`

```typescript
interface NavBarProps {
  brand: { name: string; logo?: string; href?: string };
  links: NavLink[];
  actions?: NavAction[];                // Right-side buttons (Login, Sign Up)
  sticky?: boolean;
  transparent?: boolean;                // Transparent on hero, solid on scroll
  variant?: "default" | "centered" | "sidebar";
  mobileBreakpoint?: BreakpointKey;
}

interface NavLink {
  label: string;
  path?: string;                        // Blu route
  href?: string;                        // External link
  children?: NavLink[];                 // Dropdown menu
  icon?: string;
}

interface NavAction {
  label: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  // Action wired via ViewNode.actions
}
```

### 6.9 Additional blocks

| URN | Display Name | Category | Description |
|-----|-------------|----------|-------------|
| `urn:blu:block:stats` | Stats Section | data | Key metrics with numbers, labels, icons |
| `urn:blu:block:team` | Team Section | marketing | Team member grid with photos, bios |
| `urn:blu:block:contact` | Contact Section | form | Contact info + embedded contact form |
| `urn:blu:block:gallery` | Image Gallery | media | Lightbox gallery with grid/masonry layout |
| `urn:blu:block:banner` | Banner | marketing | Dismissible top-of-page announcement |
| `urn:blu:block:logo-cloud` | Logo Cloud | marketing | Partner/client logo strip |
| `urn:blu:block:newsletter` | Newsletter | form | Email capture with inline form |
| `urn:blu:block:video-embed` | Video Embed | media | YouTube/Vimeo embed with aspect ratio |
| `urn:blu:block:map` | Map | media | Embedded map (Google Maps, Mapbox) |
| `urn:blu:block:timeline` | Timeline | display | Chronological events display |

---

## 7. Form Components

Forms follow the contract defined in `docs/blu/specification.md` §13 Forms. The form system is a composition of two component types:

### 7.1 `urn:blu:block:form`

The form wrapper. Manages form state via the EventBus (form:init, form:change, form:validate, form:submit, etc.).

```typescript
// Props defined in docs/blu/specification.md §13 (Forms — FormViewNode.form)
// This component:
// 1. Dispatches form:init on mount
// 2. Renders fields based on form.fields declaration
// 3. Handles validation per form.validation.mode
// 4. Dispatches form:submit → resolves submit.target action
// 5. Renders loading/success/error states

const formMeta: ComponentMeta = {
  urn: "urn:blu:block:form",
  displayName: "Form",
  description: "Schema-driven form with validation, submission, and state management",
  category: "form",
  tags: ["form", "input", "submit", "data-entry", "contact", "survey"],
  version: "1.0.0",
  slots: [
    { name: "header", displayName: "Form Header", description: "Title/description above fields" },
    { name: "actions", displayName: "Form Actions", description: "Submit/reset buttons" },
    { name: "footer", displayName: "Form Footer", description: "Content below submit" },
  ],
  constraints: { standalone: true },
  a11y: { role: "form", keyboardInteraction: "Tab between fields, Enter to submit" },
  defaultProps: { validation: { mode: "onBlur" }, layout: "vertical" },
  requiredProps: ["form"],
};
```

### 7.2 `urn:blu:ui:field`

Individual form field renderer. Automatically rendered by `urn:blu:block:form` based on field declarations, but also usable standalone.

```typescript
interface FieldProps {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  value?: unknown;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  options?: FormFieldOption[];

  // Field type-specific
  multiline?: boolean;                  // For textarea
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  accept?: string;                      // For file input
  multiple?: boolean;                   // For select/file
  
  // Visual
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "filled" | "flushed";
  fullWidth?: boolean;
  labelPosition?: "top" | "left" | "floating";
}

type FormFieldType =
  | "text" | "email" | "password" | "number" | "date" | "select"
  | "multiselect" | "checkbox" | "radio" | "textarea" | "file"
  | "tel" | "url" | "color" | "range" | "toggle" | "rich-text";
```

---

## 8. Icon System (`blu-icons`)

### 8.1 Architecture

Icons are SVG-based React components, individually importable for tree-shaking.

```typescript
// Import individual icons (tree-shakeable)
import { IconHome, IconSearch, IconUser } from "@kitsy/blu-icons";

// Registry-based (for ViewNode resolution)
// Icons auto-register as "urn:blu:icon:<name>"
registry.get("urn:blu:icon:home");  // → IconHome component
```

### 8.2 Icon props (universal)

```typescript
interface IconProps {
  name: string;                         // Icon identifier
  size?: number | "xs" | "sm" | "md" | "lg" | "xl"; // px or named size
  color?: ColorValue;                   // Defaults to currentColor
  strokeWidth?: number;
  className?: string;
  title?: string;                       // Accessible title
}
```

### 8.3 Core icon set (minimum viable)

The UMD bundle includes a curated subset (~40 icons). The full set is available via npm tree-shaking.

**Required for UMD bundle (used by blocks and forms):**

Navigation: `home`, `menu`, `close`, `chevron-left`, `chevron-right`, `chevron-down`, `chevron-up`, `arrow-left`, `arrow-right`, `external-link`

Actions: `search`, `plus`, `minus`, `edit`, `trash`, `copy`, `download`, `upload`, `share`, `refresh`

Status: `check`, `x`, `alert-circle`, `info`, `alert-triangle`, `clock`, `loader`

Content: `user`, `mail`, `phone`, `map-pin`, `calendar`, `star`, `heart`, `image`, `file`, `folder`

Social: `twitter`, `facebook`, `instagram`, `linkedin`, `github`, `youtube`

### 8.4 Icon naming convention

Kebab-case, noun-first: `arrow-right`, `alert-circle`, `user-plus`, `file-text`. Matches Lucide naming where possible for familiarity.

---

## 9. Template Specifications (`blu-templates`)

Templates are complete `ApplicationConfiguration` documents (or partial ViewNode trees) that serve as starting points. They are NOT React components — they are data.

### 9.1 Template types

| Type | Description | Example |
|------|-------------|---------|
| **Page template** | Complete single-page layout | Landing page, About page, Contact page |
| **Site template** | Complete multi-page ApplicationConfiguration | Business site, Portfolio, Storefront |
| **Section template** | Reusable ViewNode subtree | Hero + Features + CTA combo |
| **Component template** | Pre-configured ViewNode | Pre-styled card, pre-built pricing table |

### 9.2 Template schema

```typescript
interface BluTemplate {
  id: string;                           // "template:landing-saas"
  name: string;                         // "SaaS Landing Page"
  description: string;
  category: "landing" | "business" | "portfolio" | "blog" | "storefront" | "dashboard" | "section";
  thumbnail: string;
  tags: string[];
  
  // Content
  type: "site" | "page" | "section" | "component";
  content: ApplicationConfiguration | ViewNode[] | ViewNode;
  
  // Theme
  suggestedTheme?: Partial<ThemeConfig>;
  
  // Metadata
  author: string;
  version: string;
  license?: string;
  previewUrl?: string;                  // Live preview link
}
```

### 9.3 MVP template catalog

| Template | Type | Category | Components Used |
|----------|------|----------|----------------|
| **Starter Landing** | site | landing | hero, features (3-col), cta, footer |
| **SaaS Landing** | site | landing | navbar, hero, features, pricing, testimonials, faq, cta, footer |
| **Business Card** | site | business | navbar, hero, features (services), team, contact form, map, footer |
| **Portfolio** | site | portfolio | navbar, hero, gallery, about, contact, footer |
| **Simple Storefront** | site | storefront | navbar, hero, product grid (data-bound), product detail, cart, footer |
| **Blog Layout** | page | blog | navbar, post list (data-bound), post detail, sidebar, footer |
| **Dashboard Shell** | page | dashboard | sidebar nav, header bar, stats grid, data table, chart area |
| **Contact Page** | page | business | hero (compact), contact form, map, office hours |
| **Hero + Features** | section | landing | hero, 3-column features section |
| **Pricing Section** | section | landing | pricing block with 3 plans + toggle |

Each template is a valid `ApplicationConfiguration` or `ViewNode[]` that passes `@kitsy/blu-validate`. AI can use templates as few-shot examples when generating new configs.

---

## 10. Component Lifecycle & Hooks

### 10.1 ViewNode lifecycle events

```
Mount:
  1. ViewNode resolved from config
  2. Data bindings initiated (if data prop present)
  3. Component rendered with resolved props
  4. actions.onLoad fired (if defined)
  5. IntersectionObserver attached (if actions.onVisible defined)

Update:
  1. Props change (from state, data binding, or config patch)
  2. Component re-renders with new props
  3. Data re-fetched if params changed

Unmount:
  1. Data subscriptions cleaned up
  2. IntersectionObserver disconnected
  3. Pending effects cancelled (AbortSignal)
```

### 10.2 Available hooks (for custom component authors)

```typescript
// Access Blu context inside a custom component
import { useBluBus, useBluState, useBluData, useBluNavigation, useBluTheme } from "@kitsy/blu-context";

// Bus interaction
const bus = useBluBus();
bus.dispatch({ type: "custom:event", payload: { ... } });

// State read/write
const [value, setValue] = useBluState("cart.itemCount");

// Data source access
const { data, loading, error, refetch } = useBluData("products", { category: "bread" });

// Navigation
const { navigate, currentPath, params } = useBluNavigation();

// Theme tokens
const { tokens, resolveColor, resolveSpacing } = useBluTheme();
```

---

## 11. Theming Contract

### 11.1 Theme tokens

Every component reads visual values from the theme token system, never from hardcoded values.

```typescript
interface ThemeTokens {
  // Colors
  colors: {
    primary: ColorScale;               // 50, 100, 200, ..., 900
    secondary: ColorScale;
    neutral: ColorScale;
    success: ColorScale;
    warning: ColorScale;
    error: ColorScale;
    info: ColorScale;
    background: { default: string; subtle: string; muted: string };
    foreground: { default: string; muted: string; subtle: string };
    border: { default: string; muted: string };
  };

  // Typography
  typography: {
    fontFamily: { sans: string; serif: string; mono: string };
    fontSize: Record<TypographySize, string>;     // xs: "0.75rem", sm: "0.875rem", ...
    fontWeight: Record<string, number>;
    lineHeight: Record<string, string>;
    letterSpacing: Record<string, string>;
  };

  // Spacing
  spacing: Record<SpacingKey, string>;  // xs: "0.25rem", sm: "0.5rem", md: "1rem", ...

  // Border radius
  radius: Record<RadiusKey, string>;    // sm: "0.25rem", md: "0.375rem", lg: "0.5rem", full: "9999px"

  // Shadows
  shadow: Record<ShadowKey, string>;    // sm, md, lg, xl

  // Breakpoints
  breakpoints: Record<BreakpointKey, string>; // sm: "640px", md: "768px", ...

  // Z-index
  zIndex: Record<string, number>;       // dropdown: 1000, modal: 1100, toast: 1200
}

type ColorScale = {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
};
```

### 11.2 Component theming rules

1. **Never hardcode colors, spacing, or typography values** — always reference tokens
2. **Use CSS custom properties** generated by CssBuilder: `var(--blu-color-primary-500)`
3. **Support dark mode** via token inversion, not component-level logic
4. **Variant styles derive from tokens** — `variant="primary"` uses `colors.primary`, not a separate palette

### 11.3 Theme override in ViewNode

```json
{
  "id": "special-section",
  "componentUrn": "urn:blu:grid:section",
  "style": {
    "--blu-color-primary-500": "#FF6B35",
    "--blu-spacing-md": "1.5rem"
  },
  "children": [...]
}
```

Scoped overrides via CSS custom properties. Child components inherit the override without explicit prop passing.

---

## 12. Accessibility Requirements

### 12.1 Baseline requirements (all components)

| Requirement | Implementation |
|------------|---------------|
| Semantic HTML | Use correct element (`<button>`, `<nav>`, `<main>`, `<h1-h6>`) |
| Keyboard navigation | All interactive elements focusable via Tab, activated via Enter/Space |
| ARIA labels | `aria-label` or `aria-labelledby` on all interactive elements |
| Color contrast | 4.5:1 for text, 3:1 for large text (WCAG AA) |
| Focus indicators | Visible focus ring on all focusable elements |
| Screen reader text | `sr-only` class for supplementary text |
| Reduced motion | Respect `prefers-reduced-motion` media query |

### 12.2 Component-specific requirements

| Component | Requirements |
|-----------|-------------|
| Modal | Focus trap, Escape to close, `aria-modal`, restore focus on close |
| Tabs | `role="tablist"`, `role="tab"`, `role="tabpanel"`, Arrow keys to navigate |
| Accordion | `aria-expanded`, Enter/Space to toggle |
| Drawer | Same as Modal |
| Toast | `role="alert"`, `aria-live="polite"` |
| Form | Labels linked to inputs via `htmlFor`/`id`, error messages via `aria-describedby` |
| Table | `<th scope="col">`, sortable headers announce sort state |
| Carousel | Pause autoplay, announce current slide |

### 12.3 AI validation (accessibility pipeline step)

```typescript
function checkAccessibility(config: ApplicationConfiguration): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of walkViewNodes(config)) {
    const meta = registry.getMeta(node.componentUrn);
    if (!meta) continue;

    // Check required accessible labels
    for (const labelProp of meta.a11y?.requiredLabels || []) {
      if (!node.props?.[labelProp]) {
        errors.push({
          path: `${node.id}.props.${labelProp}`,
          message: `${meta.displayName} requires "${labelProp}" for accessibility`,
          severity: "warning",
        });
      }
    }

    // Check images have alt text
    if (node.componentUrn === "urn:blu:core:image" && !node.props?.alt) {
      errors.push({
        path: `${node.id}.props.alt`,
        message: "Image requires alt text for screen readers",
        severity: "error",
      });
    }

    // Check heading hierarchy (h1 before h2, etc.)
    // Check form labels linked to fields
    // Check color contrast (if theme tokens available)
  }

  return errors;
}
```

---

## 13. Responsive Behavior

### 13.1 Breakpoints

| Key | Min Width | Target |
|-----|-----------|--------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

### 13.2 ViewNode responsive overrides

```json
{
  "id": "hero",
  "componentUrn": "urn:blu:block:hero",
  "props": {
    "height": "lg",
    "alignment": "center"
  },
  "responsive": {
    "sm": {
      "props": { "height": "md", "alignment": "left" }
    },
    "md": {
      "props": { "height": "md" }
    }
  }
}
```

Mobile-first: base props apply to all sizes. Responsive overrides apply at breakpoint and above.

### 13.3 Component-level responsive behavior

Components that have `responsiveProps` in their meta can accept per-breakpoint values:

```json
{
  "componentUrn": "urn:blu:grid:columns",
  "props": {
    "columns": 3,
    "gap": "md"
  },
  "responsive": {
    "sm": { "props": { "columns": 1 } },
    "md": { "props": { "columns": 2 } }
  }
}
```

---

## 14. Custom Component Authoring Guide

### 14.1 For developers using Blu

```typescript
import React from "react";
import { useBluBus, useBluTheme } from "@kitsy/blu-context";
import type { ComponentMeta } from "@kitsy/blu-schema";

// 1. Define the component
interface ProductCardProps {
  name: string;
  price: number;
  image: string;
  currency?: string;
  onSale?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ name, price, image, currency = "USD", onSale }) => {
  const { tokens } = useBluTheme();
  const bus = useBluBus();

  return (
    <div style={{ borderRadius: tokens.radius.md, overflow: "hidden" }}>
      <img src={image} alt={name} style={{ width: "100%", objectFit: "cover" }} />
      <div style={{ padding: tokens.spacing.md }}>
        <h3>{name}</h3>
        <p>{onSale && <span>SALE </span>}{currency} {price.toFixed(2)}</p>
      </div>
    </div>
  );
};

// 2. Define metadata
const productCardMeta: ComponentMeta = {
  urn: "urn:plugin:store:product-card",
  displayName: "Product Card",
  description: "Displays a product with image, name, and price",
  category: "display",
  tags: ["product", "ecommerce", "card", "store"],
  version: "1.0.0",
  slots: [],
  constraints: { maxChildren: 0 },
  a11y: { requiredLabels: ["name"] },
  propSchema: {
    type: "object",
    required: ["name", "price", "image"],
    properties: {
      name: { type: "string", description: "Product name" },
      price: { type: "number", minimum: 0, description: "Price" },
      image: { type: "string", format: "uri", description: "Product image URL" },
      currency: { type: "string", default: "USD" },
      onSale: { type: "boolean", default: false },
    }
  },
  defaultProps: { currency: "USD", onSale: false },
  requiredProps: ["name", "price", "image"],
};

// 3. Register
registry.register("urn:plugin:store:product-card", ProductCard, productCardMeta);
```

### 14.2 Rules for custom components

1. **Props must be serializable.** No functions, React elements, or class instances in props. All values must survive `JSON.stringify()`/`JSON.parse()`.
2. **No `dangerouslySetInnerHTML`.** This is enforced by linting in the Kitsy marketplace.
3. **Use Blu hooks, not raw React context.** `useBluBus()` not `useContext(BusContext)`. This ensures the component works if the context provider changes.
4. **Respect theme tokens.** Don't hardcode `color: "#FF0000"`. Use `tokens.colors.error[500]`.
5. **Declare a propSchema.** Without it, Studio can't render a property panel and AI can't generate valid instances.
6. **Handle missing props gracefully.** Components will receive `undefined` for optional props and must not crash.
7. **Be responsive by default.** Use relative units, flex/grid layout, and respect breakpoint tokens.

---

## 15. AI Generation Rules

### 15.1 Component selection

When Kitsy Mind generates a config, it selects components from the registry catalog. Rules:

1. **Use block components for common patterns.** "Landing page hero" → `urn:blu:block:hero`, not a custom composition of Box + Text + Image.
2. **Fall back to primitives for unusual layouts.** Custom visual arrangements use Box, Stack, Columns.
3. **Never hallucinate URNs.** Only use URNs that exist in the provided catalog. If unsure, use `urn:blu:core:box` as a safe fallback.
4. **Respect required props.** Every required prop in `propSchema` must be provided.
5. **Use data bindings for dynamic content.** Don't hardcode product names in 20 ViewNodes; use `repeat` with a data source.
6. **Wire actions declaratively.** Buttons use `ViewNode.actions.onClick`, not custom props.

### 15.2 Prompt structure for AI

When Kitsy Mind calls the LLM, it provides:

```
1. The ApplicationConfiguration JSON Schema
2. A catalog of available ComponentMeta (URNs + propSchemas + descriptions)
3. Available DataSource types
4. Available Action types
5. The user's theme tokens (so AI uses correct brand colors)
6. 2-3 few-shot examples of valid configs
7. The user's prompt
```

### 15.3 Validation checklist (post-generation)

Every AI-generated config must pass:

| Step | Check | Auto-fixable? |
|------|-------|--------------|
| 1 | JSON Schema validation | No (regenerate) |
| 2 | All componentUrns exist in registry | Yes (replace with closest match) |
| 3 | Required props present | Yes (fill from defaultProps) |
| 4 | Data source references resolve | Yes (remove dangling bindings) |
| 5 | Action targets valid | Yes (remove invalid actions) |
| 6 | No circular ViewNode references | No (regenerate) |
| 7 | Accessibility baseline | Yes (add missing alt/labels with placeholder) |

---

## Appendix: Complete URN Catalog (Quick Reference)

### Primitives (`blu-core`)
| URN | Display Name |
|-----|-------------|
| `urn:blu:core:box` | Box |
| `urn:blu:core:text` | Text |
| `urn:blu:core:image` | Image |
| `urn:blu:core:link` | Link |
| `urn:blu:core:spacer` | Spacer |

### Layout (`blu-grid`)
| URN | Display Name |
|-----|-------------|
| `urn:blu:grid:stack` | Stack |
| `urn:blu:grid:columns` | Columns |
| `urn:blu:grid:container` | Container |
| `urn:blu:grid:section` | Section |
| `urn:blu:grid:divider` | Divider |
| `urn:blu:grid:aspect-ratio` | Aspect Ratio |

### UI (`blu-ui`)
| URN | Display Name |
|-----|-------------|
| `urn:blu:ui:button` | Button |
| `urn:blu:ui:card` | Card |
| `urn:blu:ui:badge` | Badge |
| `urn:blu:ui:avatar` | Avatar |
| `urn:blu:ui:alert` | Alert |
| `urn:blu:ui:modal` | Modal |
| `urn:blu:ui:tabs` | Tabs |
| `urn:blu:ui:table` | Table |
| `urn:blu:ui:tooltip` | Tooltip |
| `urn:blu:ui:drawer` | Drawer |
| `urn:blu:ui:spinner` | Spinner |
| `urn:blu:ui:progress` | Progress Bar |
| `urn:blu:ui:skeleton` | Skeleton |
| `urn:blu:ui:breadcrumb` | Breadcrumb |
| `urn:blu:ui:pagination` | Pagination |
| `urn:blu:ui:tag` | Tag |
| `urn:blu:ui:accordion` | Accordion |
| `urn:blu:ui:toast` | Toast |

### Blocks (`blu-blocks`)
| URN | Display Name |
|-----|-------------|
| `urn:blu:block:hero` | Hero Banner |
| `urn:blu:block:features` | Features Section |
| `urn:blu:block:pricing` | Pricing Section |
| `urn:blu:block:testimonials` | Testimonials |
| `urn:blu:block:cta` | Call to Action |
| `urn:blu:block:faq` | FAQ |
| `urn:blu:block:footer` | Footer |
| `urn:blu:block:navbar` | Navigation Bar |
| `urn:blu:block:stats` | Stats Section |
| `urn:blu:block:team` | Team Section |
| `urn:blu:block:contact` | Contact Section |
| `urn:blu:block:gallery` | Image Gallery |
| `urn:blu:block:banner` | Banner |
| `urn:blu:block:logo-cloud` | Logo Cloud |
| `urn:blu:block:newsletter` | Newsletter |
| `urn:blu:block:video-embed` | Video Embed |
| `urn:blu:block:map` | Map |
| `urn:blu:block:timeline` | Timeline |

### Forms (`blu-blocks`)
| URN | Display Name |
|-----|-------------|
| `urn:blu:block:form` | Form |
| `urn:blu:ui:field` | Form Field |

### Total: 5 primitives + 6 layout + 18 UI + 18 blocks + 2 forms = **49 components**
