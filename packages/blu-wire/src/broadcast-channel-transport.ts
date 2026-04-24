import { type BluEvent } from "@kitsy/blu-core";

import {
  BaseTransport,
  type BroadcastChannelConstructor,
  type BroadcastChannelLike,
} from "./transport.js";

/** Construction options for `BroadcastChannelTransport`. */
export interface BroadcastChannelTransportOptions {
  channelName?: string;
  BroadcastChannel?: BroadcastChannelConstructor;
  now?: () => number;
}

interface BroadcastEnvelope {
  senderId: string;
  event: BluEvent;
}

/**
 * Browser-style transport backed by `BroadcastChannel`.
 *
 * A constructor may be injected for tests or non-browser environments.
 */
export class BroadcastChannelTransport extends BaseTransport {
  readonly #channelName: string;
  readonly #broadcastChannelCtor?: BroadcastChannelConstructor;
  readonly #senderId: string;

  #channel?: BroadcastChannelLike;
  #messageListener?: (event: { data: unknown }) => void;

  constructor(options: BroadcastChannelTransportOptions = {}) {
    super("broadcast-channel", options.now);
    this.#channelName = options.channelName ?? "blu-broadcast";
    this.#broadcastChannelCtor =
      options.BroadcastChannel ?? resolveBroadcastChannel();
    this.#senderId = `${this.#channelName}:${Math.random().toString(36).slice(2)}`;
  }

  async connect(): Promise<void> {
    if (this.status === "connected") {
      return;
    }

    this.setStatus("connecting");

    if (this.#broadcastChannelCtor === undefined) {
      this.setStatus(
        "error",
        "BroadcastChannel is not available in this environment.",
      );
      throw new Error("BroadcastChannel is not available in this environment.");
    }

    try {
      this.#channel = new this.#broadcastChannelCtor(this.#channelName);
      this.#messageListener = (messageEvent) => {
        void this.#handleMessage(messageEvent.data);
      };
      this.#channel.addEventListener("message", this.#messageListener);
      this.setStatus("connected");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.setStatus("error", detail);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.#channel !== undefined && this.#messageListener !== undefined) {
      this.#channel.removeEventListener("message", this.#messageListener);
      this.#channel.close();
    }

    this.#channel = undefined;
    this.#messageListener = undefined;
    this.setStatus("disconnected");
  }

  offer(event: BluEvent): boolean {
    if (
      this.status !== "connected" ||
      this.#channel === undefined ||
      event.durability !== "replicated"
    ) {
      return false;
    }

    this.#channel.postMessage({
      senderId: this.#senderId,
      event,
    } satisfies BroadcastEnvelope);
    return true;
  }

  async #handleMessage(message: unknown): Promise<void> {
    const envelope = parseBroadcastEnvelope(message);
    if (envelope === null || envelope.senderId === this.#senderId) {
      return;
    }
    await this.deliver(envelope.event);
  }
}

function resolveBroadcastChannel(): BroadcastChannelConstructor | undefined {
  if ("BroadcastChannel" in globalThis) {
    return globalThis.BroadcastChannel as BroadcastChannelConstructor;
  }
  return undefined;
}

function parseBroadcastEnvelope(message: unknown): BroadcastEnvelope | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const candidate = message as Partial<BroadcastEnvelope>;
  if (typeof candidate.senderId !== "string") {
    return null;
  }
  if (typeof candidate.event !== "object" || candidate.event === null) {
    return null;
  }
  return candidate as BroadcastEnvelope;
}
