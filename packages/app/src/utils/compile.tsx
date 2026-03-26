import { AppConfig, ApplicationConfiguration } from "@/@types";
import { RenderOptions } from "@/@types/ApplicationConfiguration";
import { View } from "@/@types/View";
import { applicationDefaults } from "@/defaults/applicationDefaults";
import {
  AppContext,
  deepMerge,
  validateAppContext,
} from "@kitsy/blu-context";
import { prepareApp } from "./prepareApp";

const views = (app: Partial<ApplicationConfiguration>) => {
  const appViews = (app?.views as unknown as View[] | undefined) ?? [];
  return (appViews ?? []).map((v) => ({
    navBar: app?.config?.shell?.navBar,
    appBar: app?.config?.shell?.appBar,
    ...v,
  }));
};

const defaults = () => {
  const d = applicationDefaults as any;
  return {
    title: d?.title || d?.meta?.title || "",
    home: d?.home,
    views: d?.views ?? [],
    brandName: d?.brand?.name ?? "",
    brandLogo: d?.brand?.logo ?? "",
    navBar: {
      links: d?.config?.navBar?.links ?? [],
      display: d?.config?.navBar?.display ?? true,
    },
    appBar: {
      title: d?.config?.appBar?.title ?? "",
      display: d?.config?.appBar?.display ?? true,
    },
    theme: d?.config?.theme ?? {},
  } as Partial<AppContext>;
};

const input = (app: Partial<ApplicationConfiguration>) => {
  const a = app as any;
  return a
    ? {
        title: a?.title || a?.meta?.title,
        home: a?.home,
        views: a?.views,
        brandName: a?.brand?.name,
        brandLogo: a?.brand?.logo,
        appBar: {
          title: a?.config?.shell?.appBar?.title,
          display: a?.config?.shell?.appBar?.display,
        },
        navBar: {
          links: a?.config?.shell?.navBar?.links,
          display: a?.config?.shell?.navBar
            ? a?.config?.shell?.navBar?.display
            : false,
          render: a?.config?.shell?.navBar?.render,
        },
        theme: a?.config?.theme,
      }
    : {};
};

const init = (app: Partial<ApplicationConfiguration>): AppContext => {
  // Build a flat runtime snapshot from defaults and app config
  const flatDefaults = defaults();
  const flatFromApp = input(app);

  const providerDefaults = deepMerge<AppContext>(
    flatDefaults,
    //   { views: /resolvedViews, home },
  );

  const initialRuntime = deepMerge<import("@kitsy/blu-context").AppContext>(
    {} as any,
    providerDefaults as any,
    flatFromApp as any,
  );
  const result = validateAppContext(initialRuntime);
  if (!result.ok) {
    const msg =
      `Application runtime validation failed:\n` +
      result.issues.map((i) => `- ${i.path}: ${i.message}`).join("\n");
    throw new Error(msg);
  }

  const merged = deepMerge<AppContext>(
    {},
    providerDefaults ?? {},
    flatFromApp ?? {},
  );

  return merged;
};

export type Compilation = {
  views: View[];
  home: string;
  context: string;
  init: AppContext;
};

export function compile(
  config?: AppConfig,
  options?: RenderOptions,
) {
  const app = prepareApp(config, options);
  console.log("application with config:", app);
  const resolvedViews = views(app);
  const intial = init(app);
  const home = app?.home;
  const contextPath = app?.contextPath || "/";
  return { views: resolvedViews, home, contextPath, init: intial };
}
