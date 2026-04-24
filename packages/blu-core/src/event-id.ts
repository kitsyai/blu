/**
 * ULID generator for `BluEvent.eventId`.
 *
 * A ULID is a 26-character Crockford base32 string consisting of:
 *   - 10 chars encoding a 48-bit millisecond timestamp
 *   - 16 chars encoding 80 bits of randomness
 *
 * The leading timestamp makes IDs sortable by emission time without
 * requiring an additional comparator. Within the same millisecond, the
 * generator increments the random component monotonically so that two
 * IDs created back-to-back maintain their relative order.
 *
 * Specification: https://github.com/ulid/spec
 */

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LENGTH = 32;
const TIMESTAMP_LENGTH = 10;
const RANDOMNESS_LENGTH = 16;

let lastTimestamp = -1;
let lastRandomness: number[] = new Array(RANDOMNESS_LENGTH).fill(0);

function getRandomBytes(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(buffer);
    return buffer;
  }
  // Deterministic fallback for sandboxed environments without WebCrypto.
  // ULIDs in this fallback are still unique-per-process but not
  // cryptographically random. The slate guards against duplicates anyway.
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

function encodeTimestamp(timestamp: number): string {
  if (timestamp < 0 || !Number.isFinite(timestamp)) {
    throw new RangeError(
      `createEventId: timestamp must be a non-negative finite number, received ${timestamp}`,
    );
  }
  let value = Math.floor(timestamp);
  let encoded = "";
  for (let i = 0; i < TIMESTAMP_LENGTH; i++) {
    const mod = value % ENCODING_LENGTH;
    encoded = CROCKFORD_ALPHABET[mod]! + encoded;
    value = (value - mod) / ENCODING_LENGTH;
  }
  return encoded;
}

function encodeRandomness(values: number[]): string {
  let encoded = "";
  for (let i = 0; i < RANDOMNESS_LENGTH; i++) {
    encoded += CROCKFORD_ALPHABET[values[i]! % ENCODING_LENGTH];
  }
  return encoded;
}

function incrementRandomness(values: number[]): number[] {
  const next = values.slice();
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]! < ENCODING_LENGTH - 1) {
      next[i] = next[i]! + 1;
      return next;
    }
    next[i] = 0;
  }
  // Overflow: restart from a fresh random sequence.
  return Array.from(getRandomBytes(RANDOMNESS_LENGTH)).map(
    (b) => b % ENCODING_LENGTH,
  );
}

/**
 * Returns a new ULID for use as a `BluEvent.eventId`.
 *
 * @param now Optional override of the millisecond timestamp. Useful for tests
 *            and replay scenarios where the event time is not the wall clock.
 */
export function createEventId(now: number = Date.now()): string {
  let randomness: number[];
  if (now === lastTimestamp) {
    randomness = incrementRandomness(lastRandomness);
  } else {
    randomness = Array.from(getRandomBytes(RANDOMNESS_LENGTH)).map(
      (b) => b % ENCODING_LENGTH,
    );
  }
  lastTimestamp = now;
  lastRandomness = randomness;
  return encodeTimestamp(now) + encodeRandomness(randomness);
}

/** Returns true when the value is a syntactically valid ULID string. */
export function isEventId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length !== TIMESTAMP_LENGTH + RANDOMNESS_LENGTH) return false;
  for (const ch of value) {
    if (!CROCKFORD_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * Extracts the millisecond timestamp encoded in the leading 10 characters
 * of a ULID. Throws if the input is not a valid ULID.
 */
export function eventIdTimestamp(eventId: string): number {
  if (!isEventId(eventId)) {
    throw new TypeError(
      `eventIdTimestamp: not a valid event id: ${String(eventId)}`,
    );
  }
  let value = 0;
  for (let i = 0; i < TIMESTAMP_LENGTH; i++) {
    const ch = eventId[i]!;
    value = value * ENCODING_LENGTH + CROCKFORD_ALPHABET.indexOf(ch);
  }
  return value;
}
