import { requireRole } from "@/lib/api/auth";
import { handleApiError, success } from "@/lib/api/response";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    await requireRole(["admin"]);

    const adminDb = getAdminDb();
    const [activitiesSnap, usersSnap, extractionsSnap, favoritesSnap] =
      await Promise.all([
        adminDb.collection("actividades").count().get(),
        adminDb.collection("usuarios").count().get(),
        adminDb.collection("extracciones").count().get(),
        adminDb.collectionGroup("favoritos").count().get(),
      ]);

    const publishedActivities = await adminDb
      .collection("actividades")
      .where("estado", "==", "publicado")
      .count()
      .get();
    const draftActivities = await adminDb
      .collection("actividades")
      .where("estado", "==", "borrador")
      .count()
      .get();

    const byType = await Promise.all(
      ["taller", "curso", "club"].map(async (tipo) => {
        const snap = await adminDb
          .collection("actividades")
          .where("tipo", "==", tipo)
          .where("estado", "==", "publicado")
          .count()
          .get();
        return { tipo, count: snap.data().count };
      }),
    );

    return success({
      totalActivities: activitiesSnap.data().count,
      publishedActivities: publishedActivities.data().count,
      draftActivities: draftActivities.data().count,
      totalUsers: usersSnap.data().count,
      totalExtractions: extractionsSnap.data().count,
      totalFavorites: favoritesSnap.data().count,
      byType,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
