import { Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { handleApiError, success } from "@/lib/api/response";
import { publishRequestSchema, validateRequest } from "@/lib/api/validation";
import { formularioAFirestore } from "@/lib/data/normalizar-actividad";
import { getAdminDb } from "@/lib/firebase/admin";

// Publica el borrador en el mismo documento (no crea una copia) con los datos
// revisados en el formulario, que llegan validados por publishRequestSchema.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const session = await requireRole(["organizador"]);
    const body = await request.json();
    const { draftId, actividad } = validateRequest(publishRequestSchema, body);

    const adminDb = getAdminDb();
    const draftRef = adminDb.collection("actividades").doc(draftId);
    const draft = await draftRef.get();
    const draftData = draft.data();
    if (!draftData) return handleApiError(new Error("NOT_FOUND"));
    if (draftData.organizadorId !== session.uid) {
      return handleApiError(new Error("FORBIDDEN"));
    }

    const ahora = Timestamp.now();
    await draftRef.update({
      ...formularioAFirestore(actividad),
      estado: "publicado",
      publishedAt: ahora,
      updatedAt: ahora,
    });

    return success({ id: draftId });
  } catch (err) {
    return handleApiError(err);
  }
}
