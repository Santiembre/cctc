"use client";
import { Timestamp } from "firebase/firestore";
import { deserializeTimestamps } from "@/lib/serialization";

/**
 * Reconstruye como `Timestamp` de `firebase/firestore` las fechas que el servidor
 * mandó con `serializeTimestamps`, para que `.toDate()` / `.toMillis()` funcionen.
 * Los documentos vienen de Firestore sin validar; el tipo T es un supuesto del llamador.
 */
export function hydrateTimestamps<T>(value: unknown): T {
  return deserializeTimestamps(value, Timestamp.fromMillis) as T;
}
