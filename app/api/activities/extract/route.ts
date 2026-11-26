import { Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import {
  esTipoArchivoIA,
  extraerActividadDeArchivo,
  TAMANO_MAXIMO_BYTES,
  TAMANO_MAXIMO_MB,
} from "@/lib/ai/gemini";
import { getServerSession } from "@/lib/api/auth";
import { error, handleApiError, success } from "@/lib/api/response";
import {
  convertirFechas,
  normalizarRespuestaIA,
} from "@/lib/data/normalizar-actividad";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeTimestamps } from "@/lib/serialization";

const HTTP_SOLICITUD_INVALIDA = 400;
const HTTP_DEMASIADO_GRANDE = 413;
const HTTP_TIPO_NO_SOPORTADO = 415;

// Confianza simplificada: un valor fijo por campo extraído (sin logprobs del modelo).
const CONFIANZA_CAMPO_EXTRAIDO = 0.85;
const CONFIANZA_CAMPO_FALTANTE = 0;

const CAMPOS_ACTIVIDAD = [
  "titulo",
  "tipo",
  "area",
  "descripcion",
  "modalidad",
  "sede",
  "enlaceVirtual",
  "cupo",
  "costo",
  "moneda",
  "requisitos",
  "enlaceInscripcion",
  "etiquetas",
  "sesiones",
  "horarios",
  "fechaInicio",
  "fechaFin",
] as const;

// POST multipart/form-data con el campo "archivo" (PDF o imagen del cartel).
// El archivo va directo a Gemini; no se guarda en Cloud Storage.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const session = await getServerSession();
    if (
      !session ||
      session.role !== "organizador" ||
      !session.organizadorAprobado
    ) {
      return handleApiError(new Error("FORBIDDEN"));
    }

    let formulario: FormData;
    try {
      formulario = await request.formData();
    } catch {
      return error(
        'Envía el archivo como multipart/form-data en el campo "archivo".',
        HTTP_SOLICITUD_INVALIDA,
      );
    }

    const archivo = formulario.get("archivo");
    if (!(archivo instanceof File) || !archivo.size) {
      return error("No se recibió ningún archivo.", HTTP_SOLICITUD_INVALIDA);
    }
    const mimeType = archivo.type;
    if (!esTipoArchivoIA(mimeType)) {
      return error(
        "Tipo de archivo no permitido. Usa PDF, JPG, PNG o WebP.",
        HTTP_TIPO_NO_SOPORTADO,
      );
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      return error(
        `El archivo excede ${TAMANO_MAXIMO_MB} MB.`,
        HTTP_DEMASIADO_GRANDE,
      );
    }

    // El archivo va inline en la petición a Gemini.
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const rawText = await extraerActividadDeArchivo(buffer, mimeType);
    let respuestaIA: unknown;
    try {
      respuestaIA = JSON.parse(rawText);
    } catch {
      return handleApiError(new Error("Error parseando respuesta de IA"));
    }

    const extraida = convertirFechas(normalizarRespuestaIA(respuestaIA));
    const camposFaltantes = CAMPOS_ACTIVIDAD.filter(
      (campo) => !extraida[campo],
    );
    const confianza = Object.fromEntries(
      CAMPOS_ACTIVIDAD.map((campo) => [
        campo,
        extraida[campo] ? CONFIANZA_CAMPO_EXTRAIDO : CONFIANZA_CAMPO_FALTANTE,
      ]),
    );

    const ahora = Timestamp.now();
    const borrador = {
      ...extraida,
      organizadorId: session.uid,
      organizadorNombre:
        session.profile?.nombre || session.email || "Organizador",
      estado: "borrador",
      createdAt: ahora,
      updatedAt: ahora,
    };

    const adminDb = getAdminDb();
    const extractionRef = adminDb.collection("extracciones").doc();
    await extractionRef.set({
      actividad: extraida,
      confianza,
      camposFaltantes,
      textoCrudo: rawText,
      archivoNombre: archivo.name,
      archivoTipo: mimeType,
      archivoBytes: archivo.size,
      createdAt: ahora,
    });

    const draftRef = adminDb.collection("actividades").doc();
    await draftRef.set({ ...borrador, extractionId: extractionRef.id });

    return success({
      extractionId: extractionRef.id,
      draftId: draftRef.id,
      actividad: serializeTimestamps(borrador),
      confianza,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
