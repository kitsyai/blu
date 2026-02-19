import { RuleRegistry } from "./RuleRegistry";
import { CSSObject, MatchResult, RuleContext, RuleEngine } from "../../@types";

function stripPrefix(cls: string, prefix: string) {
  return prefix && cls.startsWith(prefix) ? cls.slice(prefix.length) : cls;
}

type Options = { enableArbitraryValues: boolean; prefix: string };

const re = {
  important: /^!/,
  negative: /^-/,
  variantToken: /^[a-z-]+:/,
  arbitrary: /^\[(.+)\]$/,
};

export class RuleRunner {
    private readonly reg: RuleRegistry;
    private readonly opts: Options;
    private _cache: Map<string, MatchResult | false>;
    
    constructor(reg: RuleRegistry, opts: any) {
      this.reg = reg;
      this.opts = opts;
      reg.finalize();
      this._cache = new Map<string, MatchResult | false>();
    }
  // Arbitrary property [prop:value]
  //   if (opts.enableArbitraryValues) {
  //     reg.addPatternRule({
  //       match: (cls) => {
  //         if (!cls.startsWith("[") || !cls.endsWith("]")) return false;
  //         const content = cls.slice(1, -1);
  //         const i = content.indexOf(":");
  //         if (i < 1) return false;
  //         return {
  //           arbitraryProp: content.slice(0, i).trim(),
  //           body: content.slice(i + 1).trim(),
  //           raw: cls,
  //         };
  //       },
  //       apply: (m, meta, ctx) => style(m.arbitraryProp, m.body, ctx, meta),
  //     });
  //   }

  match(className: string): MatchResult | false {
      const hit = this._cache.get(className);
      if (hit !== undefined) return hit;

      const cls = stripPrefix(className, this.opts.prefix);
      const tokens: string[] = [];
      let base = cls;

      while (re.variantToken.test(base)) {
        const t = base.slice(0, base.indexOf(":"));
        tokens.push(t);
        base = base.slice(base.indexOf(":") + 1);
      }

      const important = re.important.test(base);
      if (important) base = base.slice(1);

      const negative = re.negative.test(base);
      if (negative) base = base.slice(1);

      // exact
      const r1 = this.reg.exact.get(base);
      if (r1) {
        const m = r1.match(base);
        if (m) {
          (m as any).rule = r1;
          const res = { ...m, tokens, important, negative, raw: className };
          this._cache.set(className, res);
          return res;
        }
      }

      // prefix (longest first)
      for (const { key, rule } of this.reg.prefixes) {
        if (!base.startsWith(key)) continue;
        const m = rule.match(base);
        if (m) {
          (m as any).rule = rule;
          const res = { ...m, tokens, important, negative, raw: className };
          this._cache.set(className, res);
          return res;
        }
      }

      // pattern
      for (const rule of this.reg.patterns) {
        const m = rule.match(base);
        if (m) {
          (m as any).rule = rule;
          const res = { ...m, tokens, important, negative, raw: className };
          this._cache.set(className, res);
          return res;
        }
      }

      this._cache.set(className, false);
      return false;
    }

    render(m: any, meta: any, ctx: RuleContext): CSSObject[] {
      if (!m || !m.rule || typeof m.rule.apply !== "function") return [];
      const out = m.rule.apply(m, meta, ctx);
      return Array.isArray(out) ? out : [out];
    }

    enumerate(ctx: RuleContext, o: any) {
        this.reg.enumerateAll(ctx, { families: o?.families });
    }
}
