"use client";

// Almacén del MVP en el navegador (localStorage).
// Sustituye temporalmente a Firestore: colección `actividades` (publicadas
// desde /publicar) y subcolección `usuarios/{id}/favoritos`.

import { useSyncExternalStore } from "react";
import { ACTIVIDADES_SEMILLA, type Actividad } from "@/lib/actividades";

const CLAVE_PUBLICADAS = "hub:actividades-publicadas";
const CLAVE_FAVORITOS = "hub:favoritos";
const EVENTO_CAMBIO = "hub:cambio";

const SIN_DATOS = "[]";

function leerCrudo(clave: string): string {
  try {
    return window.localStorage.getItem(clave) ?? SIN_DATOS;
  } catch {
    return SIN_DATOS;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Modo privado o almacenamiento lleno: el MVP sigue funcionando en memoria.
  }
  window.dispatchEvent(new Event(EVENTO_CAMBIO));
}

function suscribir(aviso: () => void): () => void {
  window.addEventListener(EVENTO_CAMBIO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

/** Cachea el último parseo para que useSyncExternalStore reciba una referencia estable. */
function crearLector<T>(
  clave: string,
  parsear: (crudo: string) => T,
  vacio: T,
): () => T {
  let ultimoCrudo: string | null = null;
  let ultimoValor: T = vacio;
  return () => {
    const crudo = leerCrudo(clave);
    if (crudo !== ultimoCrudo) {
      ultimoCrudo = crudo;
      try {
        ultimoValor = parsear(crudo);
      } catch {
        ultimoValor = vacio;
      }
    }
    return ultimoValor;
  };
}

const SIN_PUBLICADAS: readonly Actividad[] = [];
const SIN_FAVORITOS: readonly string[] = [];

const leerPublicadas = crearLector<readonly Actividad[]>(
  CLAVE_PUBLICADAS,
  (crudo) => JSON.parse(crudo) as readonly Actividad[],
  SIN_PUBLICADAS,
);

const leerFavoritos = crearLector<readonly string[]>(
  CLAVE_FAVORITOS,
  (crudo) => JSON.parse(crudo) as readonly string[],
  SIN_FAVORITOS,
);

let ultimasPublicadas: readonly Actividad[] | null = null;
let ultimoCatalogo: readonly Actividad[] = ACTIVIDADES_SEMILLA;

function leerCatalogo(): readonly Actividad[] {
  const publicadas = leerPublicadas();
  if (publicadas !== ultimasPublicadas) {
    ultimasPublicadas = publicadas;
    ultimoCatalogo = [...publicadas, ...ACTIVIDADES_SEMILLA];
  }
  return ultimoCatalogo;
}

/** Catálogo completo: lo publicado en este navegador primero, luego la semilla. */
export function useActividades(): readonly Actividad[] {
  return useSyncExternalStore(
    suscribir,
    leerCatalogo,
    () => ACTIVIDADES_SEMILLA,
  );
}

export function useFavoritos(): readonly string[] {
  return useSyncExternalStore(suscribir, leerFavoritos, () => SIN_FAVORITOS);
}

/** `true` solo después de hidratar: evita mostrar "no encontrada" antes de leer localStorage. */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => true,
    () => false,
  );
}

export function alternarFavorito(id: string): void {
  const actuales = leerFavoritos();
  const siguiente = actuales.includes(id)
    ? actuales.filter((f) => f !== id)
    : [...actuales, id];
  escribir(CLAVE_FAVORITOS, siguiente);
}

export function publicarActividad(actividad: Actividad): void {
  escribir(CLAVE_PUBLICADAS, [actividad, ...leerPublicadas()]);
}
