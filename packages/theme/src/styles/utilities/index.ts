import { CssBuilder, BuilderPlugin } from "../../core/builder";
import type { BuilderOptions } from "../../@types";
import { buildUtilities } from "./build";
import { ClassEngine } from "../../core/runtime/ClassEngine";
import { ClassEnginePlugin, CSSObject } from "@/@types";
import { variants } from "../../utils/variants";

const utilitiesEngine = (b: CssBuilder): ClassEnginePlugin => {
  const { theme } = b.opts;

  const rules = buildUtilities(theme, {
    enableArbitraryValues: false /*b.opts.enableArbitraryValues !== false*/,
    prefix: b.opts.prefix ?? "",
  });

  const v = variants(b.opts.screens.breakpoints);

  const ruleCtx = {
    screens: b.opts.screens.breakpoints,
    important: b.opts.important,
  };

  return {
    name: "utilities-engine",
    variants(tokens, decls) {
      return v(tokens ?? [], decls ?? []);
    },
    match(className: string) {
      return rules.match(className);
    },
    render(match, meta): CSSObject[] {
      return rules.render(match, meta, ruleCtx);
    },
    enumerate: (o) => rules.enumerate(ruleCtx, o),
  };
};

export const utilitiesPlugin =
  (opts: BuilderOptions = {}): BuilderPlugin =>
  (builder: CssBuilder) => {
    const engine = new ClassEngine({ plugins: [utilitiesEngine(builder)] });

    // Late injection into the "utilities" layer
    builder.onBeforeSerialize(() => {
      const presetClasses = engine.enumerate({ variants: true });
      const cssObjects = engine.compile(presetClasses);
      const css = ClassEngine.toCss(cssObjects);
      if (css && css.trim()) builder.utilities(css, "key");
    });

    return builder;
  };
