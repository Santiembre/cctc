// Los Timestamp de Firestore son clases: no se pueden pasar de un Server Component
// a un Client Component, y por JSON llegan como objetos sin `.toDate()`.
// En el servidor se convierten a una marca con milisegundos y en el cliente se
// reconstruyen como `Timestamp` de `firebase/firestore`.

export interface SerializedTimestamp {
  readonly __timestamp: number;
}

function isTimestampLike(value: unknown): value is { toMillis(): number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  );
}

function isSerializedTimestamp(value: unknown): value is SerializedTimestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { __timestamp?: unknown }).__timestamp === "number"
  );
}

function mapDeep(value: unknown, transform: (v: unknown) => unknown): unknown {
  const transformed = transform(value);
  if (transformed !== value) return transformed;
  if (Array.isArray(value)) return value.map((v) => mapDeep(v, transform));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, mapDeep(v, transform)]),
    );
  }
  return value;
}

/** Servidor: Timestamp (Admin o cliente) → `{ __timestamp: ms }`. */
export function serializeTimestamps(value: unknown): unknown {
  return mapDeep(value, (v) =>
    isTimestampLike(v) ? { __timestamp: v.toMillis() } : v,
  );
}

/** Cliente: `{ __timestamp: ms }` → lo que devuelva `fromMillis` (p. ej. `Timestamp.fromMillis`). */
export function deserializeTimestamps(
  value: unknown,
  fromMillis: (ms: number) => unknown,
): unknown {
  return mapDeep(value, (v) =>
    isSerializedTimestamp(v) ? fromMillis(v.__timestamp) : v,
  );
}
