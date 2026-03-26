import { bus } from '@kitsy/blu-bus';

export { render } from './browser';
export { ReactApplication } from './ReactApplication';
export * from './utils/ErrorBoundary';

export * from "@kitsy/blu-core";
export * from "@kitsy/blu-bus";
export * from "@kitsy/blu-ui";
export * from "@kitsy/blu-context";
export * from "@kitsy/blu-icons";
export * from "@kitsy/blu-grid";
export * from "@kitsy/blu-route";
export * from "@kitsy/blu-blocks";

export type * from "./@types";
export * from "./theme";

export const enableAuth = () => {
    bus.use((cmd, next) => {
        if (cmd.type === "navigate" && cmd.target === "/admin") {
            console.log("redirecting to login");
            // if (!isLoggedIn()) {
            //     console.warn("Redirecting to /login instead of /admin");
            //     next({ type: "navigate", target: "/login" });
            //     return;
            // }
        }
        next(cmd);
    });
}

export const enableTransitions = () => {
    bus.use(async (cmd, next) => {
        if (cmd.type === "navigate") {
            console.log("showing the loader to login");
            // showLoadingSpinner();
            // await fakeDelay(500); // simulate fetch or animation
            // hideLoadingSpinner();
        }
        next(cmd);
    });
}