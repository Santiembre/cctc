import { Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { getServerSession } from "@/lib/api/auth";
import { handleApiError, success } from "@/lib/api/response";
import { favoriteRequestSchema, validateRequest } from "@/lib/api/validation";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return handleApiError(new Error("UNAUTHORIZED"));

    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection("usuarios")
      .doc(session.uid)
      .collection("favoritos")
      .orderBy("createdAt", "desc")
      .get();

    const favoritos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return success(favoritos);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return handleApiError(new Error("UNAUTHORIZED"));

    const body = await request.json();
    const { actividadId } = validateRequest(favoriteRequestSchema, body);

    const adminDb = getAdminDb();
    const favRef = adminDb
      .collection("usuarios")
      .doc(session.uid)
      .collection("favoritos")
      .doc(actividadId);
    const favDoc = await favRef.get();

    if (favDoc.exists) {
      await favRef.delete();
      return success({ added: false });
    }

    await favRef.set({ actividadId, createdAt: Timestamp.now() });
    return success({ added: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return handleApiError(new Error("UNAUTHORIZED"));

    const { searchParams } = new URL(request.url);
    const actividadId = searchParams.get("actividadId");
    if (!actividadId)
      return handleApiError(
        new Error("VALIDATION_ERROR: actividadId requerido"),
      );

    const adminDb = getAdminDb();
    await adminDb
      .collection("usuarios")
      .doc(session.uid)
      .collection("favoritos")
      .doc(actividadId)
      .delete();
    return success({ removed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
