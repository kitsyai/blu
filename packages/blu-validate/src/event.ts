import {
  isAuthority as _isAuthority,
  isDurability,
  isEventClass,
  isEventId,
  isOrigin,
  type BluEvent,
  type PartialEvent,
} from "@kitsy/blu-core";
import { ErrorCollector, ok, err, type Result } from "./result.js";

void _isAuthority;

const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)+$/;

/**
 * Validates a finalized `BluEvent` envelope. The bus calls this after
 * `applyEnvelopeDefaults` and before slate.append.
 */
export function validateEvent(event: unknown): Result<BluEvent> {
  const c = new ErrorCollector("");
  if (!isObject(event)) {
    c.push("envelope.shape.notObject", "Event must be an object");
    return err(c.errors());
  }
  validateEnvelopeFields(event, c, /* requireFinalized */ true);
  if (c.hasErrors()) return err(c.errors());
  return ok(event as unknown as BluEvent);
}

/**
 * Validates a `PartialEvent` before `applyEnvelopeDefaults` runs. The
 * `eventId`, `timestamp`, and `sequence` fields are not required.
 */
export function validatePartialEvent(event: unknown): Result<PartialEvent> {
  const c = new ErrorCollector("");
  if (!isObject(event)) {
    c.push("envelope.shape.notObject", "Event must be an object");
    return err(c.errors());
  }
  validateEnvelopeFields(event, c, /* requireFinalized */ false);
  if (c.hasErrors()) return err(c.errors());
  return ok(event as unknown as PartialEvent);
}

function validateEnvelopeFields(
  event: Record<string, unknown>,
  c: ErrorCollector,
  requireFinalized: boolean,
): void {
  // Identity
  if (requireFinalized) {
    if (typeof event.eventId !== "string") {
      c.push(
        "envelope.missing.eventId",
        "eventId is required and must be a string",
        "eventId",
      );
    } else if (!isEventId(event.eventId)) {
      c.push(
        "envelope.invalid.eventId",
        "eventId must be a 26-character ULID",
        "eventId",
      );
    }
    if (typeof event.timestamp !== "number" || !Number.isFinite(event.timestamp)) {
      c.push(
        "envelope.missing.timestamp",
        "timestamp must be a finite number",
        "timestamp",
      );
    } else if (event.timestamp < 0) {
      c.push(
        "envelope.invalid.timestamp",
        "timestamp must be non-negative",
        "timestamp",
      );
    }
    if (typeof event.sequence !== "number") {
      c.push(
        "envelope.missing.sequence",
        "sequence must be a number",
        "sequence",
      );
    }
  }

  if (typeof event.type !== "string" || event.type.length === 0) {
    c.push(
      "envelope.missing.type",
      "type is required and must be a non-empty string",
      "type",
    );
  } else if (!EVENT_TYPE_PATTERN.test(event.type)) {
    c.push(
      "envelope.invalid.type",
      `type must match pattern {module}:{entity}:{action} (lowercase, colon-separated)`,
      "type",
    );
  }

  if (typeof event.schemaVersion !== "number" || !Number.isInteger(event.schemaVersion)) {
    c.push(
      "envelope.invalid.schemaVersion",
      "schemaVersion must be an integer",
      "schemaVersion",
    );
  } else if (event.schemaVersion < 1) {
    c.push(
      "envelope.invalid.schemaVersion",
      "schemaVersion must be >= 1",
      "schemaVersion",
    );
  }

  // Classification
  if (!isEventClass(event.class)) {
    c.push(
      "envelope.invalid.class",
      "class must be one of: intent, fact, system, projection, sync, devtools",
      "class",
    );
  }
  if (!isDurability(event.durability)) {
    c.push(
      "envelope.invalid.durability",
      "durability must be one of: ephemeral, observable, journaled, replicated",
      "durability",
    );
  }

  // Payload — must be present (even as null or {}) so consumers can rely on the key.
  if (!("payload" in event)) {
    c.push("envelope.missing.payload", "payload key is required (may be null)", "payload");
  }

  // Context
  if (typeof event.emitter !== "string" || event.emitter.length === 0) {
    c.push(
      "envelope.missing.emitter",
      "emitter is required and must be a non-empty string",
      "emitter",
    );
  }
  if (event.scopePath !== undefined && typeof event.scopePath !== "string") {
    c.push(
      "envelope.invalid.scopePath",
      "scopePath must be a string when present",
      "scopePath",
    );
  }
  if (event.origin !== undefined && !isOrigin(event.origin)) {
    c.push(
      "envelope.invalid.origin",
      "origin must be one of: user, system, sync, replay, migration",
      "origin",
    );
  }

  // Causality
  if (event.causationId !== undefined && event.causationId !== null) {
    if (typeof event.causationId !== "string") {
      c.push(
        "envelope.invalid.causationId",
        "causationId must be a ULID string or null",
        "causationId",
      );
    } else if (!isEventId(event.causationId)) {
      c.push(
        "envelope.invalid.causationId",
        "causationId must be a valid ULID",
        "causationId",
      );
    }
  }
  if (requireFinalized) {
    if (typeof event.correlationId !== "string") {
      c.push(
        "envelope.missing.correlationId",
        "correlationId is required",
        "correlationId",
      );
    } else if (!isEventId(event.correlationId)) {
      c.push(
        "envelope.invalid.correlationId",
        "correlationId must be a valid ULID",
        "correlationId",
      );
    }
  } else if (event.correlationId !== undefined) {
    if (typeof event.correlationId !== "string" || !isEventId(event.correlationId)) {
      c.push(
        "envelope.invalid.correlationId",
        "correlationId, when present, must be a valid ULID",
        "correlationId",
      );
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
