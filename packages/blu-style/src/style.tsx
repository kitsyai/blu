import type { CSSProperties, ReactNode } from "react";
import type {
  ShellDensity,
  ShellTheme,
  ThemeConfiguration,
} from "@kitsy/blu-schema";

export interface ThemeBoundaryProps {
  theme: ShellTheme;
  density: ShellDensity;
  config?: ThemeConfiguration;
  children: ReactNode;
  className?: string;
}

export function ThemeBoundary({
  theme,
  density,
  config,
  children,
  className,
}: ThemeBoundaryProps): ReactNode {
  return (
    <div
      data-blu-theme={theme}
      data-blu-density={density}
      className={className}
      style={buildThemeStyles(config, theme, density)}
    >
      {children}
    </div>
  );
}

export function buildThemeStyles(
  config: ThemeConfiguration | undefined,
  theme: ShellTheme,
  density: ShellDensity,
): CSSProperties {
  const styles: Record<string, string | number> = {
    colorScheme: theme === "system" ? "light dark" : theme,
    "--blu-theme-mode": theme,
    "--blu-density": density,
  };

  if (config === undefined) {
    return styles as CSSProperties;
  }

  const namespace = config.namespace ?? "blu";
  for (const [key, value] of Object.entries(config.colors ?? {})) {
    if (typeof value === "string") {
      styles[`--${namespace}-color-${key}`] = value;
      continue;
    }

    for (const [scaleKey, scaleValue] of Object.entries(
      value as Record<string, string>,
    )) {
      styles[`--${namespace}-color-${key}-${scaleKey}`] = scaleValue;
    }
  }

  writeScale(styles, namespace, "space", config.spacing);
  writeScale(styles, namespace, "radius", config.radius);
  writeScale(styles, namespace, "shadow", config.shadow);
  writeScale(styles, namespace, "breakpoint", config.breakpoints);

  if (config.typography !== undefined) {
    writeScale(styles, namespace, "font-family", config.typography.fontFamily);
    writeScale(styles, namespace, "font-size", config.typography.fontSize);
    writeScale(styles, namespace, "font-weight", config.typography.fontWeight);
    writeScale(styles, namespace, "line-height", config.typography.lineHeight);
    writeScale(
      styles,
      namespace,
      "letter-spacing",
      config.typography.letterSpacing,
    );
  }

  return styles as CSSProperties;
}

function writeScale(
  styles: Record<string, string | number>,
  namespace: string,
  category: string,
  values: Record<string, string | number> | undefined,
): void {
  if (values === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(values)) {
    styles[`--${namespace}-${category}-${key}`] = value;
  }
}
