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

/** Projection-backed shape for one runtime form. */
export interface FormState {
  values: Readonly<Record<string, unknown>>;
  errors: Readonly<Record<string, readonly string[]>>;
  formErrors: readonly string[];
  valid: boolean;
  touched: Readonly<Record<string, boolean>>;
  submitting: boolean;
  submitCount: number;
  submittedAt?: number;
}

/** Thin React handle over a `form:{id}` projection plus common mutations. */
export interface FormHandle extends FormState {
  setField: (
    field: string,
    value: unknown,
  ) => Promise<BluEvent<{ field: string; value: unknown }>>;
  reset: () => Promise<BluEvent<Record<string, never>>>;
  validate: () => Promise<BluEvent<Record<string, never>>>;
  submit: () => Promise<BluEvent<Record<string, never>>>;
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
 * Read and mutate one form projection.
 *
 * The hook stays thin: reads come from the slate projection and writes go
 * through the bus as standard Blu events for the form runtime to interpret.
 */
export function useForm(id: string): FormHandle {
  const projectionName = normalizeFormProjectionName(id);
  const state = useProjection<FormState>(projectionName);
  const emit = useEmit();

  return useMemo(
    () => ({
      ...state,
      setField(field: string, value: unknown) {
        return emit({
          type: `${projectionName}:field-set`,
          schemaVersion: 1,
          class: "fact",
          durability: "journaled",
          payload: { field, value },
          emitter: "urn:blu:context:useForm",
        });
      },
      reset() {
        return emit({
          type: `${projectionName}:reset`,
          schemaVersion: 1,
          class: "fact",
          durability: "journaled",
          payload: {},
          emitter: "urn:blu:context:useForm",
        });
      },
      validate() {
        return emit({
          type: `${projectionName}:validate-requested`,
          schemaVersion: 1,
          class: "fact",
          durability: "journaled",
          payload: {},
          emitter: "urn:blu:context:useForm",
        });
      },
      submit() {
        return emit({
          type: `${projectionName}:submit-requested`,
          schemaVersion: 1,
          class: "fact",
          durability: "journaled",
          payload: {},
          emitter: "urn:blu:context:useForm",
        });
      },
    }),
    [emit, projectionName, state],
  );
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

function normalizeFormProjectionName(id: string): string {
  return id.startsWith("form:") ? id : `form:${id}`;
}
