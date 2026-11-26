import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActivityDetail } from '@/components/ActivityDetail';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const dynamic = 'force-dynamic';

interface ActivityPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ActivityPageProps): Promise<Metadata> {
  const { id } = await params;
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activities/${id}`, { next: { revalidate: 60 } });
  if (!response.ok) return { title: 'Actividad no encontrada' };
  const { data: activity } = await response.json();
  return {
    title: `${activity.titulo} | Hub de Aprendizaje`,
    description: activity.descripcion?.slice(0, 160),
    openGraph: {
      title: activity.titulo,
      description: activity.descripcion?.slice(0, 160),
      type: 'website',
    },
  };
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { id } = await params;
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activities/${id}`, { next: { revalidate: 60 } });
  
  if (!response.ok) notFound();
  const { data: activity } = await response.json();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <ActivityDetail activity={activity} />
        </div>
      </main>
      <Footer />
    </div>
  );
}