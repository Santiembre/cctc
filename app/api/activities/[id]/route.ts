import { Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { handleApiError, success } from "@/lib/api/response";
import { getActivityById } from "@/lib/data/activities";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const activity = await getActivityById(id);
    if (!activity) return handleApiError(new Error("NOT_FOUND"));
    return success(activity);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["organizador", "admin"]);
    const { id } = await params;
    const body = await request.json();

    const adminDb = getAdminDb();
    const docRef = adminDb.collection("actividades").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return handleApiError(new Error("NOT_FOUND"));

    const data = doc.data()!;
    if (session.role === "organizador" && data.organizadorId !== session.uid) {
      return handleApiError(new Error("FORBIDDEN"));
    }

    const updateData = {
      ...body,
      updatedAt: Timestamp.now(),
    };
    await docRef.update(updateData);
    return success({ id, ...data, ...updateData });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole(["organizador", "admin"]);
    const { id } = await params;

    const adminDb = getAdminDb();
    const docRef = adminDb.collection("actividades").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return handleApiError(new Error("NOT_FOUND"));

    const data = doc.data()!;
    if (session.role === "organizador" && data.organizadorId !== session.uid) {
      return handleApiError(new Error("FORBIDDEN"));
    }

    await docRef.update({ estado: "archivado", updatedAt: Timestamp.now() });
    return success({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
