import { Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { getServerSession } from "@/lib/api/auth";
import { handleApiError, success } from "@/lib/api/response";
import { activityListQuerySchema, validateRequest } from "@/lib/api/validation";
import { listPublishedActivities } from "@/lib/data/activities";
import { getAdminDb } from "@/lib/firebase/admin";
import { activitySchema } from "@/lib/types/activity";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = validateRequest(
      activityListQuerySchema,
      Object.fromEntries(searchParams),
    );
    return success(await listPublishedActivities(query));
  } catch (err) {
    return handleApiError(err);
  }
}

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

    const body = await request.json();
    const activityData = validateRequest(activitySchema, body);

    const adminDb = getAdminDb();
    const activity = {
      ...activityData,
      organizadorId: session.uid,
      organizadorNombre:
        session.profile?.nombre || session.email || "Organizador",
      estado: "publicado",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      publishedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection("actividades").add(activity);
    return success({ id: docRef.id, ...activity }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
