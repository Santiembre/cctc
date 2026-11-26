import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ActivityDetailView } from "@/components/ActivityDetailView";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getActivityById } from "@/lib/data/activities";
import { serializeTimestamps } from "@/lib/serialization";

export const dynamic = "force-dynamic";

const LONGITUD_DESCRIPCION_META = 160;

interface ActivityPageProps {
  params: Promise<{ id: string }>;
}

type ResultadoCarga =
  | { estado: "ok"; actividad: Record<string, unknown> }
  | { estado: "no-encontrada" }
  | { estado: "error"; mensaje: string };

/**
 * Lee la actividad directo de Firestore; nunca lanza (salvo bugs), para no tumbar la página.
 * Con `cache`, generateMetadata y la página comparten el resultado (y el error se registra una vez).
 */
const cargarActividad = cache(async function cargarActividad(
  id: string,
): Promise<ResultadoCarga> {
  try {
    const actividad = await getActivityById(id);
    return actividad
      ? { estado: "ok", actividad }
      : { estado: "no-encontrada" };
  } catch (err) {
    console.error(`No se pudo cargar la actividad ${id}:`, err);
    const detalle = err instanceof Error ? err.message : String(err);
    return {
      estado: "error",
      mensaje:
        process.env.NODE_ENV === "production"
          ? "No pudimos cargar esta actividad. Intenta de nuevo más tarde."
          : `No se pudo cargar la actividad: ${detalle} (revisa Firebase Admin en .env.local).`,
    };
  }
});

export async function generateMetadata({
  params,
}: ActivityPageProps): Promise<Metadata> {
  const { id } = await params;
  const resultado = await cargarActividad(id);
  if (resultado.estado === "no-encontrada") {
    return { title: "Actividad no encontrada" };
  }
  if (resultado.estado === "error") {
    return { title: "Actividad | Hub de Aprendizaje" };
  }

  const { titulo, descripcion } = resultado.actividad;
  const tituloTexto = typeof titulo === "string" ? titulo : "Actividad";
  const resumen =
    typeof descripcion === "string"
      ? descripcion.slice(0, LONGITUD_DESCRIPCION_META)
      : undefined;
  return {
    title: `${tituloTexto} | Hub de Aprendizaje`,
    description: resumen,
    openGraph: { title: tituloTexto, description: resumen, type: "website" },
  };
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { id } = await params;
  const resultado = await cargarActividad(id);
  if (resultado.estado === "no-encontrada") notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {resultado.estado === "ok" ? (
            <ActivityDetailView
              activity={serializeTimestamps(resultado.actividad)}
            />
          ) : (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <p>{resultado.mensaje}</p>
              <Link
                href="/"
                className="mt-2 inline-block font-medium underline"
              >
                Volver al catálogo
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
