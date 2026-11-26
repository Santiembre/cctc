import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import { VertexAI } from '@google-cloud/vertexai';
import { validateRequest, extractRequestSchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

const SYSTEM_INSTRUCTION = `Eres un asistente que extrae información de carteles y PDFs de actividades académicas (talleres, cursos, clubes) para una universidad. 
Extrae TODOS los campos posibles. Si un campo no aparece, omítelo (no lo inventes). 
Para fechas, usa ISO 8601. Para horarios, usa HH:mm (24h).
tipo: "taller" (corta duración, 1-3 sesiones), "curso" (múltiples sesiones, semanas/meses), "club" (recurrente semanal).
modalidad: "presencial", "virtual", "hibrido".
moneda: "MXN", "USD", "GRATIS".
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
    throw new Error('Vertex AI credentials not configured');
  }
  
  const vertexAI = new VertexAI({ project, location });
  return vertexAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
    },
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'organizador' || !session.organizadorAprobado) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const body = await request.json();
    const { filePath } = validateRequest(extractRequestSchema, body);

    // Download file from Cloud Storage
    const adminStorage = getAdminStorage();
    const bucket = adminStorage.bucket(process.env.STORAGE_BUCKET!);
    const file = bucket.file(filePath);
    const [buffer] = await file.download();
    const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : 
                     filePath.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' :
                     filePath.match(/\.png$/i) ? 'image/png' : 'image/webp';

    // Call Gemini
    const generativeModel = getGenerativeModel();
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: buffer.toString('base64') } },
            { text: 'Extrae la información de esta actividad y devuelve el JSON según el esquema.' },
          ],
        },
      ],
    });

    const rawText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let extracted: any;
    try {
      extracted = JSON.parse(rawText);
    } catch {
      return handleApiError(new Error('Error parseando respuesta de IA'));
    }

    // Convert date strings to Timestamps
    const convertDates = (obj: any): any => {
      if (!obj) return obj;
      const converted = { ...obj };
      for (const key of ['fechaInicio', 'fechaFin']) {
        if (converted[key]) converted[key] = Timestamp.fromDate(new Date(converted[key]));
      }
      if (converted.sesiones) {
        converted.sesiones = converted.sesiones.map((s: any) => ({
          ...s,
          fecha: s.fecha ? Timestamp.fromDate(new Date(s.fecha)) : Timestamp.now(),
        }));
      }
      return converted;
    };

    extracted = convertDates(extracted);
    extracted.organizadorId = session.uid;
    extracted.organizadorNombre = session.profile?.nombre || session.email || 'Organizador';
    extracted.estado = 'borrador';
    extracted.createdAt = Timestamp.now();
    extracted.updatedAt = Timestamp.now();

    // Calculate confidence scores (simplified - in production use logprobs)
    const confidence: Record<string, number> = {};
    const allFields = ['titulo', 'tipo', 'area', 'descripcion', 'modalidad', 'sede', 'enlaceVirtual', 'cupo', 'costo', 'moneda', 'requisitos', 'enlaceInscripcion', 'etiquetas', 'sesiones', 'horarios', 'fechaInicio', 'fechaFin'];
    allFields.forEach(f => confidence[f] = extracted[f] ? 0.85 : 0);

    // Save extraction record
    const adminDb = getAdminDb();
    const extractionRef = adminDb.collection('extracciones').doc();
    await extractionRef.set({
      actividad: extracted,
      confianza: confidence,
      camposFaltantes: allFields.filter(f => !extracted[f]),
      textoCrudo: rawText,
      archivoPath: filePath,
      createdAt: Timestamp.now(),
    });

    // Create draft activity
    const draftRef = adminDb.collection('actividades').doc();
    await draftRef.set({
      ...extracted,
      extractionId: extractionRef.id,
    });

    return success({ extractionId: extractionRef.id, draftId: draftRef.id, actividad: extracted, confianza: confidence });
  } catch (err) {
    return handleApiError(err);
  }
}