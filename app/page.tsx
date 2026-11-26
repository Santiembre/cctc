import type { Metadata } from "next";
import { CatalogGrid } from "@/components/CatalogGrid";
import { FilterBar, FilterSidebar } from "@/components/FilterSidebar";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { activityListQuerySchema, validateRequest } from "@/lib/api/validation";
import {
  type ActivityListResult,
  listPublishedActivities,
} from "@/lib/data/activities";
import { serializeTimestamps } from "@/lib/serialization";

export const metadata: Metadata = {
  title: "Hub de Aprendizaje FES Acatlán",
  description:
    "Encuentra talleres, cursos y clubes. ¿Eres organizador?: sube tu PDF y la IA llena la ficha.",
};

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const { page: PAGINA_INICIAL, limit: LIMITE_POR_DEFECTO } =
  activityListQuerySchema.parse({});

const SIN_RESULTADOS: ActivityListResult = {
  activities: [],
  pagination: {
    page: PAGINA_INICIAL,
    limit: LIMITE_POR_DEFECTO,
    total: 0,
    totalPages: 0,
  },
};

async function cargarCatalogo(
  params: Record<string, string | string[] | undefined>,
): Promise<{ resultado: ActivityListResult; aviso: string | null }> {
  const filtros = Object.fromEntries(
    Object.entries(params)
      .map(([clave, valor]) => [clave, Array.isArray(valor) ? valor[0] : valor])
      .filter(([, valor]) => valor !== undefined),
  );

  try {
    const query = validateRequest(activityListQuerySchema, filtros);
    return { resultado: await listPublishedActivities(query), aviso: null };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    if (mensaje.startsWith("VALIDATION_ERROR:")) {
      return {
        resultado: SIN_RESULTADOS,
        aviso: "Los filtros de la búsqueda no son válidos.",
      };
    }
    console.error("No se pudo cargar el catálogo:", err);
    return {
      resultado: SIN_RESULTADOS,
      aviso:
        process.env.NODE_ENV === "production"
          ? "No pudimos cargar las actividades. Intenta de nuevo más tarde."
          : `No se pudo cargar el catálogo: ${mensaje} (revisa Firebase Admin en .env.local).`,
    };
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { resultado, aviso } = await cargarCatalogo(await searchParams);
  const activities = serializeTimestamps(resultado.activities) as unknown[];
  const { pagination } = resultado;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-b from-primary/5 via-background to-background py-12 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Hub de Aprendizaje{" "}
              <span className="text-primary">FES Acatlán</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Tu catálogo centralizado de talleres, cursos y clubes.
              ¿Eres organizador?: sube tu PDF o cartel y la IA llena la ficha
              automáticamente.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/dashboard/organizer/nueva"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Publicar actividad con IA
              </a>
              <a
                href="#actividades"
                className="inline-flex items-center justify-center rounded-4xl border border-input bg-background px-4 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Explorar catálogo
              </a>
            </div>
          </div>
        </section>

        <section id="actividades" className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <FilterBar />
            <div className="mt-6">
              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No se encontraron actividades
                  </p>
                </div>
              ) : (
                <CatalogGrid activities={activities} pagination={pagination} />
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}