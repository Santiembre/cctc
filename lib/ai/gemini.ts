// Extracción de actividades con Gemini (Vertex AI).
// El archivo (PDF o imagen del cartel) se manda inline en la petición: no pasa por Cloud Storage.
// Sin imports con alias "@/" para poder probarlo directo con Node.

import { VertexAI } from "@google-cloud/vertexai";

export const TIPOS_ARCHIVO_IA = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type TipoArchivoIA = (typeof TIPOS_ARCHIVO_IA)[number];

/** Base64 crece ~33%: 10 MB de archivo ≈ 13.3 MB de petición, debajo del límite de Vertex AI y Cloud Run. */
export const TAMANO_MAXIMO_MB = 10;
const BYTES_POR_KB = 1024;
const BYTES_POR_MB = BYTES_POR_KB * BYTES_POR_KB;
export const TAMANO_MAXIMO_BYTES = TAMANO_MAXIMO_MB * BYTES_POR_MB;

export function esTipoArchivoIA(tipo: string): tipo is TipoArchivoIA {
  return (TIPOS_ARCHIVO_IA as readonly string[]).includes(tipo);
}

const SYSTEM_INSTRUCTION = `Eres un asistente que extrae información de carteles y PDFs de actividades académicas (talleres, cursos, clubes) para una universidad.
Extrae TODOS los campos posibles. Si un campo no aparece, omítelo (no lo inventes).
Para fechas, usa ISO 8601. Para horarios, usa HH:mm (24h).
tipo: "taller" (corta duración, 1-3 sesiones), "curso" (múltiples sesiones, semanas/meses), "club" (recurrente semanal).
modalidad: "presencial", "virtual", "hibrido".
moneda: "MXN", "USD", "GRATIS".
area: el tema o disciplina (por ejemplo "Programación", "Idiomas", "Arte y cultura"); NO el nombre del organizador ni de la dependencia.

Reglas de calendario (obligatorias):
- Si tipo es "taller" o "curso": usa "sesiones" y NO incluyas "horarios".
  Crea una sesión por cada fecha concreta en que hay clase. Si el cartel da un rango y días
  (por ejemplo "del 18 al 22 de enero, lunes a viernes de 16:00 a 18:00"), expándelo en una sesión
  por cada día de clase dentro del rango, cada una con su fecha (AAAA-MM-DD), horaInicio y horaFin.
  "fechaInicio" es la fecha de la primera sesión y "fechaFin" la de la última.
- Si tipo es "club": usa "horarios" (uno por día de la semana que se reúne, diaSemana 0=domingo … 6=sábado)
  y NO incluyas "sesiones". "fechaInicio" es cuándo empieza; "fechaFin" solo si el cartel la indica.
Devuelve SOLO el JSON válido con esta estructura:
{
  "titulo": "string",
  "tipo": "taller|curso|club",
  "area": "string",
  "descripcion": "string",
  "modalidad": "presencial|virtual|hibrido",
  "sede": "string",
  "enlaceVirtual": "string",
  "cupo": number,
  "costo": number,
  "moneda": "MXN|USD|GRATIS",
  "requisitos": "string",
  "enlaceInscripcion": "string",
  "etiquetas": ["string"],
  "sesiones": [{"fecha": "ISO8601", "horaInicio": "HH:mm", "horaFin": "HH:mm", "tema": "string", "sede": "string", "enlaceVirtual": "string"}],
  "horarios": [{"diaSemana": 0-6, "horaInicio": "HH:mm", "horaFin": "HH:mm", "sede": "string", "enlaceVirtual": "string"}],
  "fechaInicio": "ISO8601",
  "fechaFin": "ISO8601"
}`;

function getGenerativeModel() {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const model = process.env.GEMINI_MODEL;

  if (!project || !location || !model) {
    throw new Error("Vertex AI credentials not configured");
  }

  // En local: JSON de la cuenta de servicio del proyecto de Vertex AI (VERTEX_AI_KEY_FILE).
  // En Cloud Run se deja sin definir y se usa la cuenta de servicio del servicio (ADC).
  // Solo afecta a este cliente; Firebase Admin sigue con sus propias credenciales.
  const keyFilename = process.env.VERTEX_AI_KEY_FILE;
  const vertexAI = new VertexAI({
    project,
    location,
    googleAuthOptions: keyFilename ? { keyFilename } : undefined,
    // El SDK arma `${location}-aiplatform.googleapis.com`, que no existe para "global"
    // (donde están los modelos Gemini 3.x); ahí el host es sin prefijo.
    apiEndpoint:
      location === "global" ? "aiplatform.googleapis.com" : undefined,
  });
  return vertexAI.getGenerativeModel({
    model,
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}

/** Manda el archivo a Gemini y devuelve el texto crudo de la respuesta (JSON en texto). */
export async function extraerActividadDeArchivo(
  datos: Buffer,
  mimeType: TipoArchivoIA,
): Promise<string> {
  const result = await getGenerativeModel().generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: datos.toString("base64") } },
          {
            text: "Extrae la información de esta actividad y devuelve el JSON según el esquema.",
          },
        ],
      },
    ],
  });
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}
