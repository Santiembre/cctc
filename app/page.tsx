import { Metadata } from 'next';
import { ActivityGrid } from '@/components/ActivityGrid';
import { FilterBar, FilterSidebar } from '@/components/FilterSidebar';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Hub de Aprendizaje FES Acatlán',
  description: 'Encuentra talleres, cursos y clubes. Organizadores: sube tu PDF y la IA llena la ficha.',
};

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const queryString = new URLSearchParams(params as Record<string, string>).toString();

  // Fetch activities from API (SSR)
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activities?${queryString}`;
  const response = await fetch(apiUrl, { next: { revalidate: 60 } });
  const { activities, pagination } = await response.json();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-b from-primary/5 via-background to-background py-12 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Hub de Aprendizaje <span className="text-primary">FES Acatlán</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Tu catálogo centralizado de talleres, cursos y clubes. Organizadores: sube tu PDF o cartel y la IA llena la ficha automáticamente.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/dashboard/organizer/nueva" className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                Publicar actividad con IA
              </a>
              <a href="#actividades" className="inline-flex items-center justify-center rounded-4xl border border-input bg-background px-4 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                Explorar catálogo
              </a>
            </div>
          </div>
        </section>

        <section id="actividades" className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="lg:grid lg:grid-cols-4 lg:gap-8">
              <aside className="lg:block hidden">
                <FilterSidebar />
              </aside>
              <div className="lg:col-span-3">
                <FilterBar />
                <ActivityGrid activities={activities} pagination={pagination} />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}