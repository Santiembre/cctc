// POST /api/extraer — recibe un PDF o imagen de cartel y devuelve la ficha prellenada.
//
// MVP: la extracción está simulada con plantillas (data/extraccion-plantillas.json).
// Producción (AnalisisDeImpacto.md §5): el navegador sube el archivo a Cloud Storage
// con URL firmada, Eventarc dispara una Cloud Run function que llama a Gemini Flash
// con salida estructurada y guarda el borrador en Firestore. Para conectar Gemini,
// reemplaza `extraerSimulado` por esa llamada y conserva el contrato `ExtraccionIA`.

import datos from "@/data/extraccion-plantillas.json";
import {
  esArea,
  esModalidad,
  TIPOS,
  type TipoActividad,
} from "@/lib/actividades";
import {
  type CampoExtraido,
  type ExtraccionIA,
  formatearBytes,
  TAMANO_MAXIMO_BYTES,
  TIPOS_ARCHIVO_ACEPTADOS,
} from "@/lib/extraccion";

const HTTP_SOLICITUD_INVALIDA = 400;
const HTTP_DEMASIADO_GRANDE = 413;
const HTTP_TIPO_NO_SOPORTADO = 415;
const HTTP_ERROR_INTERNO = 500;

/** Primeras palabras típicas de archivos sin nombre descriptivo ("IMG_2034.jpg"). */
const PALABRAS_GENERICAS: ReadonlySet<string> = new Set([
  "img",
  "image",
  "scan",
  "cartel",
  "poster",
  "flyer",
  "whatsapp",
  "captura",
  "documento",
]);

/** Confianza cuando el título o el tipo se infieren del nombre del archivo. */
const CONFIANZA_TITULO_ARCHIVO = 0.82;
const CONFIANZA_TIPO_ADIVINADO = 0.55;
const LONGITUD_MINIMA_TITULO = 6;

type Plantilla = (typeof datos.plantillas)[number];

function error(mensaje: string, estado: number): Response {
  return Response.json({ error: mensaje }, { status: estado });
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

function detectarTipo(nombre: string): TipoActividad | null {
  const texto = nombre.toLowerCase();
  return TIPOS.find((tipo) => texto.includes(tipo)) ?? null;
}

/** "taller-de-react_2027.pdf" → "Taller de react 2027". Devuelve null si parece un nombre genérico. */
function tituloDesdeArchivo(nombre: string): string | null {
  const punto = nombre.lastIndexOf(".");
  const sinExtension = punto > 0 ? nombre.slice(0, punto) : nombre;
  const palabras = sinExtension
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .split(" ")
    .filter((palabra) => palabra.length > 0);
  const limpio = palabras.join(" ");
  const primera = palabras[0]?.toLowerCase() ?? "";
  if (limpio.length < LONGITUD_MINIMA_TITULO || PALABRAS_GENERICAS.has(primera))
    return null;
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function extraerSimulado(archivo: File): ExtraccionIA {
  const tipoDetectado = detectarTipo(archivo.name);
  const tipo = tipoDetectado ?? "taller";
  const plantilla: Plantilla =
    datos.plantillas.find((p) => p.tipo === tipo) ?? datos.plantillas[0];
  const { area, modalidad } = plantilla;
  if (!esArea(area) || !esModalidad(modalidad)) {
    throw new Error(`Plantilla de extracción inválida: ${plantilla.tipo}`);
  }

  const tituloArchivo = tituloDesdeArchivo(archivo.name);
  const confianza: Partial<Record<CampoExtraido, number>> = {
    ...plantilla.confianza,
    ...(tituloArchivo ? { titulo: CONFIANZA_TITULO_ARCHIVO } : {}),
    ...(tipoDetectado ? {} : { tipo: CONFIANZA_TIPO_ADIVINADO }),
  };

  return {
    campos: {
      titulo: tituloArchivo ?? plantilla.titulo,
      tipo,
      area,
      descripcion: plantilla.descripcion,
      fechaInicio: plantilla.fechaInicio,
      fechaFin: plantilla.fechaFin ?? undefined,
      horario: plantilla.horario,
      sede: plantilla.sede,
      modalidad,
      cupo: plantilla.cupo,
      costo: plantilla.costo,
      requisitos: plantilla.requisitos,
      organizador: plantilla.organizador,
      contacto: plantilla.contacto,
      enlaceInscripcion: plantilla.enlaceInscripcion,
      etiquetas: plantilla.etiquetas,
    },
    confianza,
    faltantes: plantilla.enlaceInscripcion ? [] : ["enlaceInscripcion"],
    modelo: datos.modelo,
    archivo: { nombre: archivo.name, tipo: archivo.type, bytes: archivo.size },
  };
}

export async function POST(request: Request): Promise<Response> {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return error(
      "Envía el archivo como multipart/form-data.",
      HTTP_SOLICITUD_INVALIDA,
    );
  }

  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return error("No se recibió ningún archivo.", HTTP_SOLICITUD_INVALIDA);
  }
  if (!(TIPOS_ARCHIVO_ACEPTADOS as readonly string[]).includes(archivo.type)) {
    return error(
      "Formato no soportado. Sube un PDF, JPG, PNG o WEBP.",
      HTTP_TIPO_NO_SOPORTADO,
    );
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    return error(
      `El archivo pesa ${formatearBytes(archivo.size)}; el máximo es ${formatearBytes(TAMANO_MAXIMO_BYTES)}.`,
      HTTP_DEMASIADO_GRANDE,
    );
  }

  try {
    await esperar(datos.latenciaMs);
    return Response.json(extraerSimulado(archivo));
  } catch (causa) {
    console.error("Fallo en la extracción", causa);
    return error(
      "No pudimos leer el archivo. Llena la ficha manualmente.",
      HTTP_ERROR_INTERNO,
    );
  }
}
