"use client";

import { sc } from "@kitsy/blu/server";

const config = {
  view: "Welcome to the world of apps",
};

export default function Home() {
  return sc(config);
}
