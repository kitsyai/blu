/**
 * @kitsy/blu-slate - in-memory journal, projection engine, snapshots, replay,
 * and authority enforcement for Blu.
 */

export type {
  DerivedProjection,
  JournalFilter,
  Slate,
  SlateOptions,
  SnapshotHandle,
} from "./slate.js";
export { BluSlate, createSlate } from "./slate.js";
