// Normaliza actividades antes de guardarlas en Firestore (solo servidor):
// - respuesta de Gemini → objeto con fechas como Timestamp
// - datos del formulario de revisión → documento de Firestore
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { ReviewFormData } from "@/lib/review-form";

export type DatosActividad = Record<string, unknown>;

const TIPO_CLUB = "club";
const CAMPOS_FECHA: readonly string[] = ["fechaInicio", "fechaFin"];

export function esObjeto(valor: unknown): valor is DatosActividad {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Gemini puede devolver una lista de actividades aunque el prompt pida un objeto: se toma la primera. */
export function normalizarRespuestaIA(valor: unknown): DatosActividad {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  return esObjeto(candidato) ? candidato : {};
}

/** Acepta ISO 8601 o "YYYY-MM-DD"; devuelve undefined si no es una fecha válida. */
export function aTimestamp(valor: unknown): Timestamp | undefined {
  if (typeof valor !== "string" || !valor) return undefined;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : Timestamp.fromDate(fecha);
}

/** Como aTimestamp, pero una fecha inválida es un error de validación (respuesta 400). */
function aTimestampObligatorio(valor: string, campo: string): Timestamp {
  const timestamp = aTimestamp(valor);
  if (!timestamp) {
    throw new Error(`VALIDATION_ERROR: ${campo}: fecha inválida`);
  }
  return timestamp;
}

/**
 * Convierte fechaInicio, fechaFin y la fecha de cada sesión a Timestamp.
 * Las fechas que no se pueden leer se quitan: el organizador las llena al revisar.
 */
export function convertirFechas(datos: DatosActividad): DatosActividad {
  const sinFechas = Object.fromEntries(
    Object.entries(datos).filter(([campo]) => !CAMPOS_FECHA.includes(campo)),
  );
  const fechas = Object.fromEntries(
    CAMPOS_FECHA.flatMap((campo) => {
      const timestamp = aTimestamp(datos[campo]);
      return timestamp ? [[campo, timestamp]] : [];
    }),
  );
  const sesiones = Array.isArray(datos.sesiones)
    ? datos.sesiones.filter(esObjeto).map(({ fecha, ...sesion }) => {
        const timestamp = aTimestamp(fecha);
        return timestamp ? { ...sesion, fecha: timestamp } : sesion;
      })
    : undefined;
  return { ...sinFechas, ...fechas, ...(sesiones ? { sesiones } : {}) };
}

/**
 * Datos revisados en el formulario → campos para `update()` en Firestore.
 * Un club guarda horarios y un curso/taller sesiones; el otro arreglo se borra del documento.
 */
export function formularioAFirestore(form: ReviewFormData): DatosActividad {
  const esClub = form.tipo === TIPO_CLUB;
  return {
    titulo: form.titulo,
    tipo: form.tipo,
    area: form.area,
    descripcion: form.descripcion,
    modalidad: form.modalidad,
    sede: form.sede ?? "",
    enlaceVirtual: form.enlaceVirtual ?? "",
    cupo: form.cupo ?? FieldValue.delete(),
    costo: form.costo,
    moneda: form.moneda,
    requisitos: form.requisitos ?? "",
    enlaceInscripcion: form.enlaceInscripcion ?? "",
    etiquetas: (form.etiquetas ?? []).filter((etiqueta) => etiqueta.trim()),
    fechaInicio: aTimestampObligatorio(form.fechaInicio, "fechaInicio"),
    fechaFin: form.fechaFin
      ? aTimestampObligatorio(form.fechaFin, "fechaFin")
      : FieldValue.delete(),
    sesiones: esClub
      ? FieldValue.delete()
      : (form.sesiones ?? []).map((sesion, indice) => ({
          ...sesion,
          fecha: aTimestampObligatorio(
            sesion.fecha,
            `sesiones.${indice}.fecha`,
          ),
        })),
    horarios: esClub ? (form.horarios ?? []) : FieldValue.delete(),
  };
}
