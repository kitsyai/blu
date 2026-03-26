import { packs } from "@kitsy/blu-shell/tokens/packs";
import { ThemeProvider as ThemeProviderClass } from "@kitsy/blu-shell/theme/ThemeProvider";
import {
  ThemeProvider,
  useThemeName,
  useToken,
} from "@kitsy/blu-shell/theme/react";

const tp = new ThemeProviderClass(packs.radix, "light");

/**
 * usage 
 * 
 * 
 * const colors = theme.group("light", "primitive.color");     // nested
 * const spacing = theme.group("light", "primitive.space");    // nested
 * 
 * // const tp = useThemeProvider();
 * const loaded = tp.getLoadedTheme();
 * const [name] = useThemeName();
 * const spacing = loaded.group(name, "primitive.space");
 * 
 * @returns 
 */
function Button() {
  const [theme, setTheme] = useThemeName();
  const primary = useToken("tokens.semantic.color.primary"); // or "semantic.color.primary" depending on your paths
  return (
    <button
      style={{ background: primary }}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      Toggle theme
    </button>
  );
}

export default function App() {
  return (
    <ThemeProvider value={tp}>
      <Button />
    </ThemeProvider>
  );
}
