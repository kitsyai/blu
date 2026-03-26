// import { attachBrowserAdapter } from "@kitsy/blu-shell/adapters/browser"; // if exported
import { render } from "@kitsy/blu-shell";

export function hydrateClient() {
  const state = (window as any).__BLU_STATE__;
  // if you expose attachBrowserAdapter() separately, call it before render
  // attachBrowserAdapter(); // optional if your render does it inside
  render(state.app);
}
