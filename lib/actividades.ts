// Modelo de datos del Hub de Aprendizaje (ver AnalisisDeImpacto.md, sección 2 y 3).
// En producción esto vive en la colección `actividades` de Firestore.
import semilla from "@/data/actividades-semilla.json";

export const TIPOS = ["taller", "curso", "club"] as const;
export type TipoActividad = (typeof TIPOS)[number];

export const MODALIDADES = ["presencial", "en línea", "híbrida"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const AREAS = [
  "Programación",
  "Ciencia de datos",
  "Matemáticas",
  "Idiomas",
  "Diseño",
  "Arte y cultura",
  "Emprendimiento",
  "Deporte y bienestar",
] as const;
export type Area = (typeof AREAS)[number];

export interface Actividad {
  readonly id: string;
  readonly titulo: string;
  readonly tipo: TipoActividad;
  readonly area: Area;
  readonly descripcion: string;
  /** Fecha ISO (AAAA-MM-DD). */
  readonly fechaInicio: string;
  /** Los clubes suelen no tener fecha de fin. */
  readonly fechaFin?: string;
  readonly horario: string;
  readonly sede: string;
  readonly modalidad: Modalidad;
  /** `null` = sin límite de cupo. */
  readonly cupo: number | null;
  readonly inscritos: number;
  /** En MXN; 0 = gratuito. */
  readonly costo: number;
  readonly requisitos: readonly string[];
  readonly organizador: string;
  readonly contacto: string;
  readonly enlaceInscripcion: string;
  readonly etiquetas: readonly string[];
  /** Origen de la ficha: captura manual o extraída por IA. */
  readonly origen: "manual" | "ia";
}

export const ETIQUETA_TIPO: Record<TipoActividad, string> = {
  taller: "Taller",
  curso: "Curso",
  club: "Club",
};

export function esTipo(v: string): v is TipoActividad {
  return (TIPOS as readonly string[]).includes(v);
}

export function esModalidad(v: string): v is Modalidad {
  return (MODALIDADES as readonly string[]).includes(v);
}

export function esArea(v: string): v is Area {
  return (AREAS as readonly string[]).includes(v);
}

type ActividadJson = (typeof semilla)[number];

/** Valida los campos con valores cerrados al cargar la semilla JSON. */
function aActividad(fila: ActividadJson): Actividad {
  const { tipo, modalidad, area, origen } = fila;
  if (!esTipo(tipo) || !esModalidad(modalidad) || !esArea(area)) {
    throw new Error(`Actividad semilla inválida: ${fila.id}`);
  }
  return {
    ...fila,
    tipo,
    modalidad,
    area,
    origen: origen === "ia" ? "ia" : "manual",
  };
}

/** Datos de ejemplo; en producción vienen de Firestore. */
export const ACTIVIDADES_SEMILLA: readonly Actividad[] =
  semilla.map(aActividad);

const formatoFecha = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const formatoFechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatearFecha(iso: string): string {
  return formatoFecha.format(new Date(`${iso}T00:00:00Z`));
}

export function formatearRango(inicio: string, fin?: string): string {
  if (!fin || fin === inicio) return formatearFecha(inicio);
  return `${formatoFechaCorta.format(new Date(`${inicio}T00:00:00Z`))} – ${formatearFecha(fin)}`;
}

export function formatearCosto(costo: number): string {
  if (costo === 0) return "Gratis";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(costo);
}

export function lugaresDisponibles(a: Actividad): number | null {
  return a.cupo === null ? null : Math.max(a.cupo - a.inscritos, 0);
}
