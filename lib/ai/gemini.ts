// Extracción de actividades con Gemini: Vertex AI como proveedor principal y Gemini API (API key) de respaldo.
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
Devuelve UN SOLO objeto JSON, nunca una lista. Si el cartel anuncia varias actividades, usa la principal; si anuncia varios horarios de la misma actividad, ponlos en "sesiones" (curso/taller) o "horarios" (club).
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

const PROMPT_USUARIO =
  "Extrae la información de esta actividad y devuelve el JSON según el esquema.";
const RESPUESTA_VACIA = "{}";
const UBICACION_GLOBAL = "global";
const HOST_VERTEX_GLOBAL = "aiplatform.googleapis.com";
const URL_GEMINI_API =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** Un servicio capaz de extraer la actividad; lanza un error si no responde. */
interface ProveedorIA {
  readonly nombre: string;
  readonly extraer: (datos: Buffer, mimeType: TipoArchivoIA) => Promise<string>;
}

/** Todos los proveedores configurados fallaron; `fallos` trae un mensaje por proveedor. */
export class ErrorProveedoresIA extends Error {
  readonly fallos: readonly string[];

  constructor(fallos: readonly string[]) {
    super(`Ningún proveedor de IA respondió: ${fallos.join(" | ")}`);
    this.name = "ErrorProveedoresIA";
    this.fallos = fallos;
  }
}

/** Respuesta de generateContent en la Gemini API (solo los campos que se leen). */
interface RespuestaGeminiApi {
  readonly candidates?: ReadonlyArray<{
    readonly content?: {
      readonly parts?: ReadonlyArray<{ readonly text?: string }>;
    };
  }>;
  readonly error?: { readonly message?: string };
}

/** Proveedor principal: Vertex AI con cuenta de servicio. null si faltan variables. */
function configurarVertexAI(): ProveedorIA | null {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const model = process.env.GEMINI_MODEL;
  if (!project || !location || !model) return null;

  // En local: JSON de la cuenta de servicio del proyecto de Vertex AI (VERTEX_AI_KEY_FILE).
  // En Cloud Run se deja sin definir y se usa la cuenta de servicio del servicio (ADC).
  // Solo afecta a este cliente; Firebase Admin sigue con sus propias credenciales.
  const keyFilename = process.env.VERTEX_AI_KEY_FILE;

  return {
    nombre: `Vertex AI (${model})`,
    extraer: async (datos, mimeType) => {
      const vertexAI = new VertexAI({
        project,
        location,
        googleAuthOptions: keyFilename ? { keyFilename } : undefined,
        // El SDK arma `${location}-aiplatform.googleapis.com`, que no existe para "global"
        // (donde están los modelos Gemini 3.x); ahí el host es sin prefijo.
        apiEndpoint:
          location === UBICACION_GLOBAL ? HOST_VERTEX_GLOBAL : undefined,
      });
      const result = await vertexAI
        .getGenerativeModel({
          model,
          generationConfig: { responseMimeType: "application/json" },
          systemInstruction: SYSTEM_INSTRUCTION,
        })
        .generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: datos.toString("base64") } },
                { text: PROMPT_USUARIO },
              ],
            },
          ],
        });
      return (
        result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
        RESPUESTA_VACIA
      );
    },
  };
}

/**
 * Proveedor de respaldo: Gemini API (AI Studio) con API key. null si no hay GEMINI_API_KEY.
 * Esta API no acepta cuentas de servicio, solo API keys.
 */
function configurarGeminiApi(): ProveedorIA | null {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_API_MODEL || process.env.GEMINI_MODEL;
  if (!apiKey || !model) return null;

  return {
    nombre: `Gemini API (${model})`,
    extraer: async (datos, mimeType) => {
      const respuesta = await fetch(
        `${URL_GEMINI_API}/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType, data: datos.toString("base64") } },
                  { text: PROMPT_USUARIO },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      // El cuerpo es JSON de la Gemini API; solo se leen campos opcionales.
      const cuerpo = (await respuesta.json()) as RespuestaGeminiApi;
      if (!respuesta.ok) {
        throw new Error(
          `HTTP ${respuesta.status}: ${cuerpo.error?.message ?? respuesta.statusText}`,
        );
      }
      return (
        cuerpo.candidates?.[0]?.content?.parts?.[0]?.text || RESPUESTA_VACIA
      );
    },
  };
}

/** En orden de preferencia; se omiten los que no tienen sus variables de entorno. */
function proveedoresConfigurados(): readonly ProveedorIA[] {
  return [configurarVertexAI(), configurarGeminiApi()].filter(
    (proveedor): proveedor is ProveedorIA => proveedor !== null,
  );
}

async function intentarEnOrden(
  proveedores: readonly ProveedorIA[],
  indice: number,
  datos: Buffer,
  mimeType: TipoArchivoIA,
  fallos: readonly string[],
): Promise<string> {
  const proveedor = proveedores[indice];
  if (!proveedor) throw new ErrorProveedoresIA(fallos);
  try {
    const texto = await proveedor.extraer(datos, mimeType);
    if (indice) console.warn(`IA: respondió el respaldo ${proveedor.nombre}`);
    return texto;
  } catch (err) {
    const mensaje = `${proveedor.nombre}: ${err instanceof Error ? err.message : String(err)}`;
    console.warn(`IA: falló ${mensaje}`);
    return intentarEnOrden(proveedores, indice + 1, datos, mimeType, [
      ...fallos,
      mensaje,
    ]);
  }
}

/**
 * Manda el archivo a Gemini y devuelve el texto crudo de la respuesta (JSON en texto).
 * Prueba Vertex AI y, si falla por cualquier motivo, la Gemini API.
 */
export async function extraerActividadDeArchivo(
  datos: Buffer,
  mimeType: TipoArchivoIA,
): Promise<string> {
  const proveedores = proveedoresConfigurados();
  if (!proveedores.length) {
    throw new Error(
      "No hay proveedor de IA configurado: define las variables de Vertex AI o GEMINI_API_KEY",
    );
  }
  return intentarEnOrden(proveedores, 0, datos, mimeType, []);
}
