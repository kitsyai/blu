import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Bus } from "@kitsy/blu-bus";
import type { Authority, BluEvent } from "@kitsy/blu-core";
import type { Slate } from "@kitsy/blu-slate";

const EMPTY_PROJECTIONS: readonly DevtoolsProjectionDescriptor[] = [];
const EMPTY_TRANSPORTS: readonly DevtoolsTransportSnapshot[] = [];

/** Host-supplied projection metadata for the inspector. */
export interface DevtoolsProjectionDescriptor {
  name: string;
  authority: Authority;
}

/** One projection row rendered by the inspector. */
export interface DevtoolsProjectionSnapshot {
  name: string;
  authority: Authority;
  state: unknown;
  readError?: string;
}

/**
 * Host-supplied transport snapshot.
 *
 * `blu-devtools` intentionally does not import `blu-wire`, so transport
 * monitoring uses a structural snapshot supplied by the host layer.
 */
export interface DevtoolsTransportSnapshot {
  name: string;
  status: string;
  offeredCount: number;
  receivedCount: number;
  errorCount?: number;
  lastEventType?: string;
}

/** Selected-event details derived from the current journal timeline. */
export interface DevtoolsEventDetails {
  event: BluEvent;
  ancestors: BluEvent[];
  descendants: BluEvent[];
}

/** Props for the standalone Blu devtools panel. */
export interface BluDevtoolsPanelProps {
  bus: Bus;
  slate: Slate;
  projections?: readonly DevtoolsProjectionDescriptor[];
  transports?: readonly DevtoolsTransportSnapshot[];
  initialSelectedEventId?: string;
  refreshToken?: unknown;
  title?: string;
}

/**
 * Collect the current non-ephemeral journal in deterministic display order.
 */
export async function collectJournalTimeline(
  slate: Slate,
): Promise<BluEvent[]> {
  const events: BluEvent[] = [];
  for await (const event of slate.getJournal()) {
    events.push(event);
  }
  return sortEvents(events);
}

/**
 * Read current values for the supplied projection descriptors.
 *
 * The slate does not currently expose a projection registry, so the host
 * supplies the projection catalog it wants the inspector to render.
 */
export function collectProjectionSnapshots(
  slate: Slate,
  projections: readonly DevtoolsProjectionDescriptor[],
): DevtoolsProjectionSnapshot[] {
  return projections.map((projection) => {
    try {
      return {
        name: projection.name,
        authority: projection.authority,
        state: slate.getProjection(projection.name),
      };
    } catch (error) {
      return {
        name: projection.name,
        authority: projection.authority,
        state: null,
        readError: toErrorMessage(error),
      };
    }
  });
}

/** Build the selected-event ancestry and descendant lists from a timeline. */
export function buildEventDetails(
  events: readonly BluEvent[],
  eventId: string | null,
): DevtoolsEventDetails | null {
  if (eventId === null) {
    return null;
  }

  const eventsById = new Map(events.map((event) => [event.eventId, event]));
  const selected = eventsById.get(eventId);
  if (selected === undefined) {
    return null;
  }

  const ancestors: BluEvent[] = [];
  const visitedAncestors = new Set<string>();
  let currentParentId = selected.causationId;

  while (currentParentId !== null && !visitedAncestors.has(currentParentId)) {
    visitedAncestors.add(currentParentId);
    const parent = eventsById.get(currentParentId);
    if (parent === undefined) {
      break;
    }
    ancestors.unshift(parent);
    currentParentId = parent.causationId;
  }

  const descendants = collectDescendants(events, selected.eventId);
  return {
    event: selected,
    ancestors,
    descendants,
  };
}

/** Merge new timeline events into an existing event list without duplicates. */
export function mergeTimelineEvents(
  current: readonly BluEvent[],
  incoming: readonly BluEvent[],
): BluEvent[] {
  const merged = new Map<string, BluEvent>();
  for (const event of current) {
    if (event.durability !== "ephemeral") {
      merged.set(event.eventId, event);
    }
  }
  for (const event of incoming) {
    if (event.durability !== "ephemeral") {
      merged.set(event.eventId, event);
    }
  }
  return sortEvents([...merged.values()]);
}

/** Render the standalone Stage 2 devtools panel. */
export function BluDevtoolsPanel({
  bus,
  slate,
  projections,
  transports,
  initialSelectedEventId,
  refreshToken,
  title = "Blu Devtools",
}: BluDevtoolsPanelProps): ReactNode {
  const projectionDescriptors = projections ?? EMPTY_PROJECTIONS;
  const transportSnapshots = transports ?? EMPTY_TRANSPORTS;
  const [timeline, setTimeline] = useState<BluEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialSelectedEventId ?? null,
  );
  const [projectionSnapshots, setProjectionSnapshots] = useState<
    DevtoolsProjectionSnapshot[]
  >(() => collectProjectionSnapshots(slate, projectionDescriptors));

  useEffect(() => {
    let active = true;

    void collectJournalTimeline(slate).then((events) => {
      if (!active) {
        return;
      }
      setTimeline(events);
    });

    return () => {
      active = false;
    };
  }, [slate, refreshToken]);

  useEffect(() => {
    return bus.subscribe(
      (event) => event.durability !== "ephemeral",
      (event) => {
        setTimeline((current) => mergeTimelineEvents(current, [event]));
      },
    );
  }, [bus]);

  useEffect(() => {
    setProjectionSnapshots(
      collectProjectionSnapshots(slate, projectionDescriptors),
    );

    const unsubscriptions = projectionDescriptors.map((projection) => {
      try {
        return slate.subscribeProjection(projection.name, () => {
          setProjectionSnapshots(
            collectProjectionSnapshots(slate, projectionDescriptors),
          );
        });
      } catch {
        return () => {};
      }
    });

    return () => {
      for (const unsubscribe of unsubscriptions) {
        unsubscribe();
      }
    };
  }, [slate, projectionDescriptors, refreshToken]);

  useEffect(() => {
    if (timeline.length === 0) {
      setSelectedEventId(null);
      return;
    }

    if (
      selectedEventId !== null &&
      timeline.some((event) => event.eventId === selectedEventId)
    ) {
      return;
    }

    const preferred =
      initialSelectedEventId !== undefined &&
      timeline.some((event) => event.eventId === initialSelectedEventId)
        ? initialSelectedEventId
        : timeline[0]?.eventId;
    setSelectedEventId(preferred ?? null);
  }, [initialSelectedEventId, selectedEventId, timeline]);

  const selectedDetails = useMemo(
    () => buildEventDetails(timeline, selectedEventId),
    [selectedEventId, timeline],
  );

  return (
    <section aria-label={title}>
      <h1>{title}</h1>

      <section>
        <h2>Timeline</h2>
        {timeline.length === 0 ? (
          <p data-testid="timeline-empty">No observable events.</p>
        ) : (
          <ol data-testid="timeline">
            {timeline.map((event) => (
              <li key={event.eventId}>
                <button
                  type="button"
                  data-testid="timeline-item"
                  onClick={() => {
                    setSelectedEventId(event.eventId);
                  }}
                >
                  {formatTimelineLabel(event)}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2>Selected Event</h2>
        {selectedDetails === null ? (
          <p data-testid="event-empty">Select an event.</p>
        ) : (
          <div data-testid="selected-event">
            <p>
              <strong>Type:</strong> {selectedDetails.event.type}
            </p>
            <p>
              <strong>Class:</strong> {selectedDetails.event.class}
            </p>
            <p>
              <strong>Correlation:</strong>{" "}
              {selectedDetails.event.correlationId}
            </p>
            <h3>Ancestors</h3>
            {selectedDetails.ancestors.length === 0 ? (
              <p data-testid="ancestors-empty">No ancestors.</p>
            ) : (
              <ol data-testid="ancestors">
                {selectedDetails.ancestors.map((event) => (
                  <li key={event.eventId}>{event.type}</li>
                ))}
              </ol>
            )}
            <h3>Descendants</h3>
            {selectedDetails.descendants.length === 0 ? (
              <p data-testid="descendants-empty">No descendants.</p>
            ) : (
              <ol data-testid="descendants">
                {selectedDetails.descendants.map((event) => (
                  <li key={event.eventId}>{event.type}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </section>

      <section>
        <h2>Projections</h2>
        {projectionSnapshots.length === 0 ? (
          <p data-testid="projections-empty">No projections registered.</p>
        ) : (
          <ul data-testid="projections">
            {projectionSnapshots.map((projection) => (
              <li key={projection.name}>
                <p>
                  <strong>{projection.name}</strong> ({projection.authority})
                </p>
                {projection.readError !== undefined ? (
                  <p>{projection.readError}</p>
                ) : (
                  <pre data-testid="projection-state">
                    {formatValue(projection.state)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Transports</h2>
        {transportSnapshots.length === 0 ? (
          <p data-testid="transports-empty">No transports registered.</p>
        ) : (
          <ul data-testid="transports">
            {transportSnapshots.map((transport) => (
              <li key={transport.name}>
                <p>
                  <strong>{transport.name}</strong> ({transport.status})
                </p>
                <p>
                  offered={transport.offeredCount} received=
                  {transport.receivedCount} errors={transport.errorCount ?? 0}
                </p>
                {transport.lastEventType !== undefined ? (
                  <p>last={transport.lastEventType}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function collectDescendants(
  events: readonly BluEvent[],
  rootEventId: string,
): BluEvent[] {
  const childrenByCause = new Map<string, BluEvent[]>();
  for (const event of events) {
    if (event.causationId === null) {
      continue;
    }
    const list = childrenByCause.get(event.causationId) ?? [];
    list.push(event);
    childrenByCause.set(event.causationId, list);
  }

  const descendants: BluEvent[] = [];
  const queue = [...(childrenByCause.get(rootEventId) ?? [])];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const event = queue.shift();
    if (event === undefined || visited.has(event.eventId)) {
      continue;
    }
    visited.add(event.eventId);
    descendants.push(event);
    queue.push(...(childrenByCause.get(event.eventId) ?? []));
  }

  return sortEvents(descendants);
}

function sortEvents(events: readonly BluEvent[]): BluEvent[] {
  return [...events].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }
    return left.eventId.localeCompare(right.eventId);
  });
}

function formatTimelineLabel(event: BluEvent): string {
  return `#${event.sequence} ${event.type} [${event.class}/${event.durability}]`;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return String(value);
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
