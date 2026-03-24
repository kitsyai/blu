import * as React from "react";
import { NavBar, AppBar } from "@pkvsinha/react-components";
import { FluidContainer } from "@pkvsinha/react-base";
import { useApplicationContext } from "@pkvsinha/react-hooks";
import { View } from "@/@types/View";
import { useRouteParams } from "@pkvsinha/react-navigate";

interface DefaultComponentViewAttributes {
  view: View;
  children: React.ReactNode;
}

interface InjectedParams {
  route: any;
}

interface InjectedProps {
  params: InjectedParams;
}

export function DefaultComponentView({
  children,
  view,
}: DefaultComponentViewAttributes) {
  const app = useApplicationContext();
  const routeParams = useRouteParams();
  const appBarRef = React.useRef<HTMLDivElement>(null);
  const navBarRef = React.useRef<HTMLDivElement>(null);
  const [contentOffsets, setContentOffsets] = React.useState({
    top: 0,
    bottom: 0,
  });

  React.useEffect(() => {
    document.title = view.meta?.title || "";
  }, [view.meta?.title]);

  const navRenderComponent = React.useMemo(() => {
    return app.navBar?.render ? app.navBar?.render() : null;
  }, [app]);

  const navLinks = React.useMemo(() => {
    const links = app?.navBar?.links ?? app?.navBar?.links ?? [];
    return (links as any[]).map((ln: any) => ({
      href:
        typeof ln?.path === "string"
          ? ln.path.startsWith("/") || ln.external
            ? ln.path
            : `/${ln.path}`
          : "/",
      label: ln?.title ?? ln?.path ?? "",
      icon: ln?.icon ?? "",
    }));
  }, [app]);

  const showNavBar = !(view.navBar?.display === false || !navLinks.length);
  const showAppBar = view.appBar?.display !== false;
  const navBarPosition =
    (view.navBar as any)?.position ?? (app.navBar as any)?.position ?? "bottom";

  React.useLayoutEffect(() => {
    const updateOffsets = () => {
      let top = 0;
      let bottom = 0;

      if (showAppBar) {
        const appBarElement =
          (appBarRef.current?.firstElementChild as HTMLElement | null) ??
          appBarRef.current;
        top += appBarElement?.getBoundingClientRect().height ?? 0;
      }

      if (showNavBar) {
        const navBarElement =
          (navBarRef.current?.firstElementChild as HTMLElement | null) ??
          navBarRef.current;
        const navBarHeight = navBarElement?.getBoundingClientRect().height ?? 0;
        const computedPosition =
          navBarElement && typeof window !== "undefined"
            ? window.getComputedStyle(navBarElement)
            : null;
        const isTopNav =
          navBarPosition === "top" ||
          (computedPosition?.top !== undefined && computedPosition.top !== "auto");

        if (isTopNav) {
          top += navBarHeight;
        } else {
          bottom += navBarHeight;
        }
      }

      setContentOffsets((current) =>
        current.top === top && current.bottom === bottom
          ? current
          : { top, bottom },
      );
    };

    updateOffsets();
    window.addEventListener("resize", updateOffsets);

    return () => {
      window.removeEventListener("resize", updateOffsets);
    };
  }, [showAppBar, showNavBar, navBarPosition, navLinks.length]);

  let child = children;

  if (React.isValidElement(children)) {
    child = React.cloneElement(children, {
      params: { route: routeParams },
    } as InjectedProps);
  }

  console.log("Rendering DefaultComponentView for view:", view);

  return (
    <>
      {showNavBar ? (
        <div ref={navBarRef}>
          {navRenderComponent ? (
            navRenderComponent
          ) : (
            <NavBar
              links={navLinks}
              position={navBarPosition}
              logo={(app as any)?.brandLogo}
              logoAlt={(app as any)?.brandName}
            />
          )}
        </div>
      ) : null}
      {showAppBar ? (
        <div ref={appBarRef}>
          <AppBar text={view.appBar?.title || ""} />
        </div>
      ) : null}
      <FluidContainer>
        <div
          style={{
            paddingTop: `${contentOffsets.top}px`,
            paddingBottom: `${contentOffsets.bottom}px`,
          }}
        >
          {child}
        </div>
      </FluidContainer>
    </>
  );
}
