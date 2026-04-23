import { render, type ApplicationConfiguration } from "@kitsy/blu";

interface BluState {
  app: ApplicationConfiguration; // Replace 'unknown' with the actual type if known
}

const state = (window as { __BLU_STATE__?: BluState }).__BLU_STATE__;
render(state?.app);
