import {
  ENVELOPE_DEFAULTS,
  createEventId,
  type BluEvent,
  type Projection,
  type ProjectionHandle,
  type Unsubscribe,
} from "@kitsy/blu-core";

/** Filters journal iteration without loading the whole result set into memory. */
export interface JournalFilter {
  type?: string;
  scopePath?: string;
  correlationId?: string;
  fromSequence?: number;
  toSequence?: number;
  predicate?: (event: BluEvent) => boolean;
}

/** Opaque snapshot handle returned by `snapshot()` and consumed by replay/compact. */
export interface SnapshotHandle {
  snapshotId: string;
  slateId: string;
  sequence: number;
  createdAt: number;
  projections: Readonly<Record<string, unknown>>;
}

/**
 * Companion API for `derived-only` projections.
 *
 * The core `Projection<T>` contract deliberately omits dependency wiring; the
 * slate owns that companion API so it can recompute derived read-models when
 * their source projections change without appending journal events.
 */
export interface DerivedProjection<TState> {
  name: string;
  authority: "derived-only";
  derivedFrom: readonly string[];
  computeFrom: (sources: Readonly<Record<string, unknown>>) => TState;
}

/** Construction options for a slate instance. */
export interface SlateOptions {
  now?: () => number;
}

/** Public contract implemented by `BluSlate`. */
export interface Slate {
  /**
   * Register an event-driven projection and return a handle for reading,
   * subscribing, and unregistering it.
   */
  registerProjection<T>(projection: Projection<T>): ProjectionHandle<T>;

  /**
   * Register a derived projection that recomputes from other named
   * projections rather than from journal events.
   */
  registerDerivedProjection<T>(
    projection: DerivedProjection<T>,
  ): ProjectionHandle<T>;

  /** Unregister a projection by name. */
  unregisterProjection(name: string): void;

  /** Read the current state of a registered projection. */
  getProjection<T>(name: string): T;

  /** Subscribe to changes for one projection. */
  subscribeProjection<T>(
    name: string,
    listener: (state: T) => void,
  ): Unsubscribe;

  /**
   * Append a finalized event.
   *
   * Observable-or-higher events are recorded in the in-memory journal.
   * `ephemeral` events are accepted but do not alter slate state.
   */
  append(event: BluEvent): Promise<void>;

  /** Stream journal events matching an optional filter. */
  getJournal(filter?: JournalFilter): AsyncIterable<BluEvent>;

  /** Capture the current projection baseline as a snapshot handle. */
  snapshot(): Promise<SnapshotHandle>;

  /** Drop journal entries at or before the supplied snapshot boundary. */
  compact(upTo: SnapshotHandle): Promise<void>;

  /** Rebuild projection state by replaying journal entries with `origin: "replay"`. */
  replay(from?: SnapshotHandle): Promise<void>;
}

type Listener = (state: unknown) => void;

interface EventProjectionRecord<TState = unknown> {
  kind: "event";
  projection: Projection<TState>;
  state: TState;
  listeners: Set<Listener>;
}

interface DerivedProjectionRecord<TState = unknown> {
  kind: "derived";
  projection: DerivedProjection<TState>;
  state: TState;
  listeners: Set<Listener>;
}

type ProjectionRecord = EventProjectionRecord | DerivedProjectionRecord;

/**
 * Concrete in-memory slate implementation for Sprint 3.
 *
 * It stores observable-or-higher events in memory, reduces event-driven
 * projections from that journal, and recomputes derived projections directly
 * from their source projections without appending synthetic journal events.
 */
export class BluSlate implements Slate {
  readonly #now: () => number;
  readonly #slateId: string;
  readonly #journal: BluEvent[] = [];
  readonly #seenEventIds = new Set<string>();
  readonly #records = new Map<string, ProjectionRecord>();
  readonly #dependents = new Map<string, Set<string>>();

  #nextSequence = 0;
  #compactedSnapshot?: SnapshotHandle;

  constructor(options: SlateOptions = {}) {
    this.#now = options.now ?? (() => Date.now());
    this.#slateId = createEventId(this.#now());
  }

  registerProjection<T>(projection: Projection<T>): ProjectionHandle<T> {
    if (projection.authority === "derived-only") {
      throw new Error(
        `Projection "${projection.name}" uses authority "derived-only" and must be registered via registerDerivedProjection().`,
      );
    }
    this.#assertProjectionNameAvailable(projection.name);

    const state = this.#initializeEventProjectionState(projection);
    const record: EventProjectionRecord<unknown> = {
      kind: "event",
      projection: projection as Projection<unknown>,
      state,
      listeners: new Set(),
    };
    this.#records.set(projection.name, record);

    return this.#createHandle<T>(projection.name);
  }

  registerDerivedProjection<T>(
    projection: DerivedProjection<T>,
  ): ProjectionHandle<T> {
    this.#assertProjectionNameAvailable(projection.name);

    if (projection.derivedFrom.length === 0) {
      throw new Error(
        `Derived projection "${projection.name}" must declare at least one source projection.`,
      );
    }
    if (projection.derivedFrom.includes(projection.name)) {
      throw new Error(
        `Derived projection "${projection.name}" cannot depend on itself.`,
      );
    }

    for (const sourceName of projection.derivedFrom) {
      this.#getRecordOrThrow(sourceName);
      const dependents = this.#dependents.get(sourceName) ?? new Set<string>();
      dependents.add(projection.name);
      this.#dependents.set(sourceName, dependents);
    }

    const record: DerivedProjectionRecord<T> = {
      kind: "derived",
      projection,
      state: projection.computeFrom(this.#readSources(projection.derivedFrom)),
      listeners: new Set(),
    };
    this.#records.set(projection.name, record);

    return this.#createHandle<T>(projection.name);
  }

  unregisterProjection(name: string): void {
    const record = this.#records.get(name);
    if (record === undefined) {
      return;
    }

    for (const dependentName of this.#dependents.get(name) ?? []) {
      this.unregisterProjection(dependentName);
    }
    this.#dependents.delete(name);

    if (record.kind === "derived") {
      for (const sourceName of record.projection.derivedFrom) {
        const dependents = this.#dependents.get(sourceName);
        if (dependents !== undefined) {
          dependents.delete(name);
          if (dependents.size === 0) {
            this.#dependents.delete(sourceName);
          }
        }
      }
    }

    this.#records.delete(name);
  }

  getProjection<T>(name: string): T {
    return this.#getRecordOrThrow(name).state as T;
  }

  subscribeProjection<T>(
    name: string,
    listener: (state: T) => void,
  ): Unsubscribe {
    const record = this.#getRecordOrThrow(name);
    const callback: Listener = listener as unknown as Listener;
    record.listeners.add(callback);
    return () => {
      record.listeners.delete(callback);
    };
  }

  async append(event: BluEvent): Promise<void> {
    if (this.#seenEventIds.has(event.eventId)) {
      return;
    }

    const normalized = this.#normalizeAppendedEvent(event);
    this.#seenEventIds.add(normalized.eventId);

    if (normalized.durability === "ephemeral") {
      return;
    }

    this.#assertAuthority(normalized);

    this.#journal.push(normalized);
    await this.#reduceEvent(normalized, false);
  }

  async *getJournal(filter: JournalFilter = {}): AsyncIterable<BluEvent> {
    for (const event of this.#journal) {
      if (matchesJournalFilter(event, filter)) {
        yield event;
      }
    }
  }

  async snapshot(): Promise<SnapshotHandle> {
    const projections: Record<string, unknown> = {};
    for (const [name, record] of this.#records) {
      if (record.kind !== "event") {
        continue;
      }
      projections[name] = serializeProjectionState(record);
    }

    return Object.freeze({
      snapshotId: createEventId(this.#now()),
      slateId: this.#slateId,
      sequence:
        this.#journal.at(-1)?.sequence ?? ENVELOPE_DEFAULTS.pendingSequence,
      createdAt: this.#now(),
      projections: Object.freeze(projections),
    });
  }

  async compact(upTo: SnapshotHandle): Promise<void> {
    this.#assertSnapshotOwnership(upTo);

    if (
      this.#compactedSnapshot !== undefined &&
      upTo.sequence < this.#compactedSnapshot.sequence
    ) {
      throw new Error(
        `Cannot compact to snapshot sequence ${upTo.sequence}; current compaction boundary is ${this.#compactedSnapshot.sequence}.`,
      );
    }

    this.#compactedSnapshot = cloneSnapshotHandle(upTo);
    const retained = this.#journal.filter(
      (event) => event.sequence > upTo.sequence,
    );
    this.#journal.length = 0;
    this.#journal.push(...retained);
  }

  async replay(from?: SnapshotHandle): Promise<void> {
    const baseline =
      from !== undefined ? cloneSnapshotHandle(from) : this.#compactedSnapshot;
    if (baseline !== undefined) {
      this.#assertSnapshotOwnership(baseline);
    }

    this.#restoreProjectionStates(baseline);

    const floor = baseline?.sequence ?? ENVELOPE_DEFAULTS.pendingSequence;
    for (const event of this.#journal) {
      if (event.sequence <= floor) {
        continue;
      }
      const replayEvent: BluEvent =
        event.origin === "replay" ? event : { ...event, origin: "replay" };
      await this.#reduceEvent(replayEvent, true);
    }
  }

  #createHandle<T>(name: string): ProjectionHandle<T> {
    return {
      read: () => this.getProjection<T>(name),
      subscribe: (listener) => this.subscribeProjection(name, listener),
      unregister: () => this.unregisterProjection(name),
    };
  }

  #initializeEventProjectionState<T>(projection: Projection<T>): T {
    const baseline = this.#compactedSnapshot;
    let state: T;

    if (baseline?.projections[projection.name] !== undefined) {
      state = deserializeProjectionState(
        projection,
        baseline.projections[projection.name],
      );
    } else {
      if (baseline !== undefined && baseline.sequence >= 0) {
        throw new Error(
          `Cannot register projection "${projection.name}" after compaction because the current snapshot does not contain its baseline state.`,
        );
      }
      state = cloneValue(projection.initialState);
    }

    for (const event of this.#journal) {
      if (baseline !== undefined && event.sequence <= baseline.sequence) {
        continue;
      }
      if (!matchesProjection(projection, event)) {
        continue;
      }
      state = stabilizeState(
        state,
        projection.reduce(state, event as never),
      ).state;
    }

    return state;
  }

  #normalizeAppendedEvent(event: BluEvent): BluEvent {
    if (event.sequence === ENVELOPE_DEFAULTS.pendingSequence) {
      const assignedSequence = this.#nextSequence++;
      return {
        ...event,
        sequence: assignedSequence,
      };
    }

    if (event.sequence >= this.#nextSequence) {
      this.#nextSequence = event.sequence + 1;
    }
    return event;
  }

  #assertAuthority(event: BluEvent): void {
    for (const record of this.#records.values()) {
      if (record.kind !== "event") {
        continue;
      }
      if (!matchesProjection(record.projection, event)) {
        continue;
      }
      if (
        record.projection.authority === "server-authoritative" &&
        event.class !== "fact"
      ) {
        throw new Error(
          `Projection "${record.projection.name}" is server-authoritative and rejects non-fact event "${event.type}".`,
        );
      }
    }
  }

  async #reduceEvent(event: BluEvent, isReplay: boolean): Promise<void> {
    void isReplay;

    const changed = new Set<string>();
    for (const [name, record] of this.#records) {
      if (record.kind !== "event") {
        continue;
      }
      if (!matchesProjection(record.projection, event)) {
        continue;
      }

      const reduced = record.projection.reduce(record.state, event as never);
      const next = stabilizeState(record.state, reduced);
      if (!next.changed) {
        continue;
      }

      record.state = next.state;
      changed.add(name);
      notifyListeners(record.listeners, record.state);
    }

    if (changed.size > 0) {
      this.#recomputeDerived(changed);
    }
  }

  #recomputeDerived(changedSources: ReadonlySet<string>): void {
    const queue = [...changedSources];
    const queued = new Set(queue);

    while (queue.length > 0) {
      const sourceName = queue.shift()!;
      for (const dependentName of this.#dependents.get(sourceName) ?? []) {
        if (queued.has(dependentName)) {
          continue;
        }

        const record = this.#records.get(dependentName);
        if (record === undefined || record.kind !== "derived") {
          continue;
        }

        const computed = record.projection.computeFrom(
          this.#readSources(record.projection.derivedFrom),
        );
        const next = stabilizeState(record.state, computed);
        if (!next.changed) {
          continue;
        }

        record.state = next.state;
        notifyListeners(record.listeners, record.state);

        queue.push(dependentName);
        queued.add(dependentName);
      }
    }
  }

  #readSources(names: readonly string[]): Readonly<Record<string, unknown>> {
    const sources: Record<string, unknown> = {};
    for (const name of names) {
      sources[name] = this.#getRecordOrThrow(name).state;
    }
    return sources;
  }

  #restoreProjectionStates(baseline?: SnapshotHandle): void {
    const changed = new Set<string>();

    for (const [name, record] of this.#records) {
      if (record.kind !== "event") {
        continue;
      }

      let nextState: unknown;
      if (baseline?.projections[name] !== undefined) {
        nextState = deserializeProjectionState(
          record.projection,
          baseline.projections[name],
        );
      } else {
        nextState = cloneValue(record.projection.initialState);
      }

      const stabilized = stabilizeState(record.state, nextState);
      record.state = stabilized.state;
      if (stabilized.changed) {
        changed.add(name);
        notifyListeners(record.listeners, record.state);
      }
    }

    for (const record of this.#records.values()) {
      if (record.kind !== "derived") {
        continue;
      }
      const computed = record.projection.computeFrom(
        this.#readSources(record.projection.derivedFrom),
      );
      const next = stabilizeState(record.state, computed);
      record.state = next.state;
      if (next.changed) {
        notifyListeners(record.listeners, record.state);
      }
    }

    if (changed.size > 0) {
      this.#recomputeDerived(changed);
    }
  }

  #getRecordOrThrow(name: string): ProjectionRecord {
    const record = this.#records.get(name);
    if (record === undefined) {
      throw new Error(`Projection "${name}" is not registered.`);
    }
    return record;
  }

  #assertProjectionNameAvailable(name: string): void {
    if (this.#records.has(name)) {
      throw new Error(`Projection "${name}" is already registered.`);
    }
  }

  #assertSnapshotOwnership(snapshot: SnapshotHandle): void {
    if (snapshot.slateId !== this.#slateId) {
      throw new Error(
        `Snapshot "${snapshot.snapshotId}" does not belong to this slate instance.`,
      );
    }
  }
}

/** Create a new `BluSlate` instance. */
export function createSlate(options: SlateOptions = {}): Slate {
  return new BluSlate(options);
}

function matchesProjection<TState>(
  projection: Projection<TState>,
  event: BluEvent,
): boolean {
  if (
    projection.scope !== undefined &&
    !matchesScopePath(projection.scope, event.scopePath)
  ) {
    return false;
  }
  return projection.eventFilter?.(event) ?? true;
}

function matchesJournalFilter(event: BluEvent, filter: JournalFilter): boolean {
  if (filter.type !== undefined && event.type !== filter.type) {
    return false;
  }
  if (
    filter.scopePath !== undefined &&
    !matchesScopePath(filter.scopePath, event.scopePath)
  ) {
    return false;
  }
  if (
    filter.correlationId !== undefined &&
    event.correlationId !== filter.correlationId
  ) {
    return false;
  }
  if (
    filter.fromSequence !== undefined &&
    event.sequence < filter.fromSequence
  ) {
    return false;
  }
  if (filter.toSequence !== undefined && event.sequence > filter.toSequence) {
    return false;
  }
  return filter.predicate?.(event) ?? true;
}

function matchesScopePath(filter: string, scopePath: string): boolean {
  const normalized = trimTrailingSlashes(filter);
  const candidate = trimTrailingSlashes(scopePath);
  return candidate === normalized || candidate.startsWith(`${normalized}/`);
}

function serializeProjectionState(record: EventProjectionRecord): unknown {
  if (record.projection.snapshot !== undefined) {
    return record.projection.snapshot.serialize(record.state);
  }
  return cloneValue(record.state);
}

function deserializeProjectionState<T>(
  projection: Projection<T>,
  raw: unknown,
): T {
  if (projection.snapshot !== undefined) {
    return projection.snapshot.deserialize(raw);
  }
  return cloneValue(raw) as T;
}

function stabilizeState<T>(
  previous: T,
  next: T,
): { changed: boolean; state: T } {
  if (Object.is(previous, next)) {
    return { changed: false, state: previous };
  }
  if (isShallowEqualObject(previous, next)) {
    return { changed: false, state: previous };
  }
  return { changed: true, state: next };
}

function isShallowEqualObject(left: unknown, right: unknown): boolean {
  if (!isPlainRecord(left) || !isPlainRecord(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false;
    }
    if (!Object.is(left[key], right[key])) {
      return false;
    }
  }

  return true;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function notifyListeners(
  listeners: ReadonlySet<Listener>,
  state: unknown,
): void {
  for (const listener of listeners) {
    listener(state);
  }
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function cloneSnapshotHandle(snapshot: SnapshotHandle): SnapshotHandle {
  return {
    snapshotId: snapshot.snapshotId,
    slateId: snapshot.slateId,
    sequence: snapshot.sequence,
    createdAt: snapshot.createdAt,
    projections: cloneValue(snapshot.projections) as Readonly<
      Record<string, unknown>
    >,
  };
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(value);
    } catch {
      return value;
    }
  }
  return value;
}
