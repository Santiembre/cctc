// Acceso a datos de actividades del lado del servidor (Firebase Admin).
// Lo usan tanto la API (/api/activities) como las páginas server-side,
// para que las páginas no se llamen a sí mismas por HTTP.

import { type Query, Timestamp } from "firebase-admin/firestore";
import { cache } from "react";
import type { z } from "zod";
import type { activityListQuerySchema } from "@/lib/api/validation";
import { getAdminDb } from "@/lib/firebase/admin";

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;

export interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ActivityListResult {
  /** Documentos tal como vienen de Firestore (fechas como Timestamp de Admin). */
  activities: Record<string, unknown>[];
  pagination: ActivityPagination;
}

export async function listPublishedActivities(
  query: ActivityListQuery,
): Promise<ActivityListResult> {
  const adminDb = getAdminDb();
  let activitiesQuery: Query = adminDb
    .collection("actividades")
    .where("estado", "==", "publicado");

  if (query.tipo)
    activitiesQuery = activitiesQuery.where("tipo", "==", query.tipo);
  if (query.area)
    activitiesQuery = activitiesQuery.where("area", "==", query.area);
  if (query.modalidad)
    activitiesQuery = activitiesQuery.where("modalidad", "==", query.modalidad);
  if (query.costo === "gratis")
    activitiesQuery = activitiesQuery.where("costo", "==", 0);
  if (query.costo === "pago")
    activitiesQuery = activitiesQuery.where("costo", ">", 0);

  // Date filtering - requires composite index
  if (query.fechaDesde) {
    activitiesQuery = activitiesQuery.where(
      "fechaInicio",
      ">=",
      Timestamp.fromDate(new Date(query.fechaDesde)),
    );
  }
  if (query.fechaHasta) {
    activitiesQuery = activitiesQuery.where(
      "fechaInicio",
      "<=",
      Timestamp.fromDate(new Date(query.fechaHasta)),
    );
  }

  // Text search - simple array-contains on etiquetas (for MVP)
  if (query.q) {
    activitiesQuery = activitiesQuery.where(
      "etiquetas",
      "array-contains",
      query.q.toLowerCase(),
    );
  }

  // Sorting
  const sortField = query.sort === "titulo" ? "titulo" : "fechaInicio";
  const sortDir = query.sort === "fechaDesc" ? "desc" : "asc";
  activitiesQuery = activitiesQuery.orderBy(sortField, sortDir);

  // Pagination
  const offset = (query.page - 1) * query.limit;
  const [snapshot, totalSnapshot] = await Promise.all([
    activitiesQuery.limit(query.limit).offset(offset).get(),
    activitiesQuery.count().get(),
  ]);
  const total = totalSnapshot.data().count;

  return {
    activities: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

/**
 * Una actividad por id, o `null` si no existe.
 * `cache` evita leer Firestore dos veces cuando generateMetadata y la página piden la misma.
 */
export const getActivityById = cache(
  async (id: string): Promise<Record<string, unknown> | null> => {
    const doc = await getAdminDb().collection("actividades").doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
);
