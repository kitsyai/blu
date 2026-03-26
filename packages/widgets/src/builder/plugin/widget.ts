import { BuilderPlugin } from "@kitsy/blu-style";

export const widgetsPlugin = (): BuilderPlugin => (b) => {
  b.rule(
    "components",
    `.w-stats`,
    `display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--ky-space-3)`,
    "w-stats",
  );
  b.rule(
    "components",
    `.w-stats__card`,
    `border:1px solid var(--ky-color-border);border-radius:12px;padding:1rem;background:#fff`,
    "w-stats-card",
  );
};
