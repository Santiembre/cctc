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
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeTimestamps } from "@/lib/serialization";

const HTTP_SOLICITUD_INVALIDA = 400;
const HTTP_DEMASIADO_GRANDE = 413;
const HTTP_TIPO_NO_SOPORTADO = 415;

// POST multipart/form-data con el campo "archivo" (PDF o imagen del cartel).
// El archivo va directo a Gemini; no se guarda en Cloud Storage.
export async function POST(request: NextRequest) {
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
    if (!(archivo instanceof File) || archivo.size === 0) {
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

    // Call Gemini (el archivo va inline en la petición)
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const rawText = await extraerActividadDeArchivo(buffer, mimeType);
    let extracted: any;
    try {
      extracted = JSON.parse(rawText);
    } catch {
      return handleApiError(new Error("Error parseando respuesta de IA"));
    }

    // Convert date strings to Timestamps
    const convertDates = (obj: any): any => {
      if (!obj) return obj;
      const converted = { ...obj };
      for (const key of ["fechaInicio", "fechaFin"]) {
        if (converted[key])
          converted[key] = Timestamp.fromDate(new Date(converted[key]));
      }
      if (converted.sesiones) {
        converted.sesiones = converted.sesiones.map((s: any) => ({
          ...s,
          fecha: s.fecha
            ? Timestamp.fromDate(new Date(s.fecha))
            : Timestamp.now(),
        }));
      }
      return converted;
    };

    extracted = convertDates(extracted);
    extracted.organizadorId = session.uid;
    extracted.organizadorNombre =
      session.profile?.nombre || session.email || "Organizador";
    extracted.estado = "borrador";
    extracted.createdAt = Timestamp.now();
    extracted.updatedAt = Timestamp.now();

    // Calculate confidence scores (simplified - in production use logprobs)
    const confidence: Record<string, number> = {};
    const allFields = [
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
    ];
    for (const f of allFields) {
      confidence[f] = extracted[f] ? 0.85 : 0;
    }

    // Save extraction record
    const adminDb = getAdminDb();
    const extractionRef = adminDb.collection("extracciones").doc();
    await extractionRef.set({
      actividad: extracted,
      confianza: confidence,
      camposFaltantes: allFields.filter((f) => !extracted[f]),
      textoCrudo: rawText,
      archivoNombre: archivo.name,
      archivoTipo: mimeType,
      archivoBytes: archivo.size,
      createdAt: Timestamp.now(),
    });

    // Create draft activity
    const draftRef = adminDb.collection("actividades").doc();
    await draftRef.set({
      ...extracted,
      extractionId: extractionRef.id,
    });

    return success({
      extractionId: extractionRef.id,
      draftId: draftRef.id,
      actividad: serializeTimestamps(extracted),
      confianza: confidence,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
