// Contrato de la extracción por IA (colección `extracciones` en Firestore).
// Es el JSON que Gemini Flash devuelve con salida estructurada.

import type { Actividad } from "@/lib/actividades";

export type CamposExtraidos = Omit<Actividad, "id" | "inscritos" | "origen">;
export type CampoExtraido = keyof CamposExtraidos;

export interface ExtraccionIA {
  readonly campos: CamposExtraidos;
  /** Confianza 0–1 por campo; debajo de UMBRAL_CONFIANZA se marca para revisión. */
  readonly confianza: Readonly<Partial<Record<CampoExtraido, number>>>;
  readonly faltantes: readonly CampoExtraido[];
  readonly modelo: string;
  readonly archivo: {
    readonly nombre: string;
    readonly tipo: string;
    readonly bytes: number;
  };
}

export const UMBRAL_CONFIANZA = 0.75;

export const TIPOS_ARCHIVO_ACEPTADOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const BYTES_POR_KB = 1024;
const MEGABYTE = BYTES_POR_KB * BYTES_POR_KB;
const LIMITE_MB = 10;
export const TAMANO_MAXIMO_BYTES = LIMITE_MB * MEGABYTE;

export function formatearBytes(bytes: number): string {
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}
