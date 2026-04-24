/**
 * Theme configuration consumed by `@kitsy/blu-style`.
 *
 * The shape is intentionally narrow at the schema layer; richer styling
 * primitives live inside `@kitsy/blu-style`. This is the contract that
 * schema authors and Studio operate against.
 */
export interface ThemeConfiguration {
  /** Token namespace, used to scope CSS variables. */
  namespace?: string;
  /** Color palette, indexed by semantic role. */
  colors?: Record<string, string | ColorScale>;
  /** Typography scale. */
  typography?: TypographyConfiguration;
  /** Spacing scale. */
  spacing?: Record<string, string | number>;
  /** Border radius scale. */
  radius?: Record<string, string | number>;
  /** Box shadows. */
  shadow?: Record<string, string>;
  /** Breakpoints for the responsive system. */
  breakpoints?: Record<string, number>;
}

/** Step-keyed color scale, e.g. `{ 50: "#...", 500: "#...", 900: "#..." }`. */
export type ColorScale = Record<string | number, string>;

export interface TypographyConfiguration {
  fontFamily?: Record<string, string>;
  fontSize?: Record<string, string | number>;
  fontWeight?: Record<string, number | string>;
  lineHeight?: Record<string, number | string>;
  letterSpacing?: Record<string, string>;
}
