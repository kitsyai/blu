import type { PropValue } from "./value.js";
import type { ViewNode } from "./view-node.js";

export type PrimaryKind =
  | "Blank"
  | "AppBar"
  | "Nav"
  | "Game"
  | "Canvas"
  | "Doc"
  | "Wizard";

export type PresenterKind = "modal" | "drawer" | "sheet";
export type OverlayKind = "beta" | "maintenance" | "offline" | "banner";
export type ShellTheme = "light" | "dark" | "system";
export type ShellDensity = "comfortable" | "compact";

export interface PresenterInstance {
  id: string;
  kind: PresenterKind;
  attachment?: "top" | "right" | "bottom" | "left";
  content: ViewNode;
  dismissOn?: "backdrop" | "escape" | "both" | "none";
  zOrder: number;
}

export interface OverlayInstance {
  id: string;
  kind: OverlayKind;
  severity?: "info" | "warning" | "error";
  message?: string;
  dismissible?: boolean;
  blocksInteraction?: boolean;
}

export interface ShellState {
  primary: PrimaryKind;
  presenters: PresenterInstance[];
  overlays: OverlayInstance[];
  theme: ShellTheme;
  density: ShellDensity;
}

export interface ShellOverlayDeclaration {
  kind: OverlayKind;
  severity?: OverlayInstance["severity"];
  message?: string;
  dismissible?: boolean;
  blocksInteraction?: boolean;
}

export interface ShellConfiguration {
  primary: PrimaryKind;
  primaryProps?: Record<string, PropValue>;
  defaultTheme?: ShellTheme;
  defaultDensity?: ShellDensity;
  overlays?: ShellOverlayDeclaration[];
}
