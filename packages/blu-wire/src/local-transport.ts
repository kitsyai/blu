import { type BluEvent } from "@kitsy/blu-core";

import { BaseTransport } from "./transport.js";

/** Construction options for `LocalTransport`. */
export interface LocalTransportOptions {
  channelName?: string;
  now?: () => number;
}

interface LocalPeer {
  deliver(event: BluEvent): Promise<void>;
}

const localChannels = new Map<string, Set<LocalPeer>>();

/**
 * In-process transport for deterministic transport tests.
 *
 * Instances connected to the same channel name deliver replicated events to
 * one another synchronously in offer order.
 */
export class LocalTransport extends BaseTransport implements LocalPeer {
  readonly #channelName: string;

  constructor(options: LocalTransportOptions = {}) {
    super("local", options.now);
    this.#channelName = options.channelName ?? "blu-local";
  }

  async connect(): Promise<void> {
    if (this.status === "connected") {
      return;
    }

    this.setStatus("connecting");
    const peers = localChannels.get(this.#channelName) ?? new Set<LocalPeer>();
    peers.add(this);
    localChannels.set(this.#channelName, peers);
    this.setStatus("connected");
  }

  async disconnect(): Promise<void> {
    if (this.status === "disconnected" || this.status === "idle") {
      this.setStatus("disconnected");
      return;
    }

    const peers = localChannels.get(this.#channelName);
    peers?.delete(this);
    if (peers !== undefined && peers.size === 0) {
      localChannels.delete(this.#channelName);
    }
    this.setStatus("disconnected");
  }

  override async deliver(event: BluEvent): Promise<void> {
    await super.deliver(event);
  }

  async offer(event: BluEvent): Promise<boolean> {
    if (this.status !== "connected" || event.durability !== "replicated") {
      return false;
    }

    const peers = localChannels.get(this.#channelName);
    if (peers === undefined) {
      return false;
    }

    let delivered = false;
    for (const peer of peers) {
      if (peer === this) {
        continue;
      }
      await peer.deliver(event);
      delivered = true;
    }
    return delivered;
  }
}
