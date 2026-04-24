import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Bus, EventFilter } from "@kitsy/blu-bus";
import type { BluEvent } from "@kitsy/blu-core";
import type { Slate } from "@kitsy/blu-slate";

/**
 * Standard shape for reading a data-source-backed projection.
 *
 * Sprint 5 only binds React to existing slate projections. The richer
 * data-source runtime arrives later, but the hook already exposes the
 * documented `{ status, data, error, fetchedAt }` projection shape.
 */
export interface DataSourceState<T> {
  status: string;
  data: T | null;
  error: unknown | null;
  fetchedAt?: number;
}

/** Props accepted by the root Blu runtime provider. */
export interface BluProviderProps {
  bus: Bus;
  slate: Slate;
  children: ReactNode;
}

const BusContext = createContext<Bus | null>(null);
const SlateContext = createContext<Slate | null>(null);

/**
 * Provides the current bus and slate instances to descendant React code.
 *
 * The provider is intentionally thin and requires explicit runtime instances
 * so applications and tests control the wiring outside the React layer.
 */
export function BluProvider({
  bus,
  slate,
  children,
}: BluProviderProps): ReactNode {
  return (
    <BusContext.Provider value={bus}>
      <SlateContext.Provider value={slate}>{children}</SlateContext.Provider>
    </BusContext.Provider>
  );
}

/** Access the current bus instance from the nearest `BluProvider`. */
export function useBus(): Bus {
  const bus = useContext(BusContext);
  if (bus === null) {
    throw new Error("useBus() must be used within a <BluProvider>.");
  }
  return bus;
}

/** Access the current slate instance from the nearest `BluProvider`. */
export function useSlate(): Slate {
  const slate = useContext(SlateContext);
  if (slate === null) {
    throw new Error("useSlate() must be used within a <BluProvider>.");
  }
  return slate;
}

/** Get a stable event emitter bound to the nearest bus instance. */
export function useEmit(): Bus["emit"] {
  const bus = useBus();
  return useMemo(() => bus.emit.bind(bus) as Bus["emit"], [bus]);
}

/**
 * Read one projection by name and re-render only when that projection's
 * state changes.
 */
export function useProjection<T>(name: string): T {
  const slate = useSlate();

  return useSyncExternalStore(
    (onStoreChange) =>
      slate.subscribeProjection<T>(name, () => {
        onStoreChange();
      }),
    () => slate.getProjection<T>(name),
    () => slate.getProjection<T>(name),
  );
}

/**
 * Read a data-source projection by id.
 *
 * Data sources materialize as named projections, so this hook is a typed
 * alias over `useProjection()` until the dedicated runtime arrives.
 */
export function useDataSource<T>(id: string): DataSourceState<T> {
  return useProjection<DataSourceState<T>>(id);
}

/**
 * Subscribe to raw bus events for advanced integration code.
 *
 * The subscription is cleaned up automatically on unmount. The latest handler
 * is invoked without forcing a re-subscribe on every render.
 */
export function useEventSubscription(
  filter: EventFilter,
  handler: (event: BluEvent) => void,
): void {
  const bus = useBus();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return bus.subscribe(filter, (event) => {
      handlerRef.current(event);
    });
  }, [bus, filter]);
}
