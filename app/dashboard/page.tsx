import { getServerSession } from '@/lib/api/auth';
import { redirect } from 'next/navigation';
import { DashboardStudent } from '@/components/DashboardStudent';
import { DashboardOrganizer } from '@/components/DashboardOrganizer';
import { DashboardAdmin } from '@/components/DashboardAdmin';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login?callbackUrl=/dashboard');
  }

  switch (session.role) {
    case 'estudiante':
      return <DashboardStudent />;
    case 'organizador':
      if (!session.organizadorAprobado) {
        return <DashboardOrganizerPending />;
      }
      return <DashboardOrganizer />;
    case 'admin':
      return <DashboardAdmin />;
    default:
      return <DashboardStudent />;
  }
}

function DashboardOrganizerPending() {
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="rounded-lg border p-8">
        <h2 className="text-2xl font-bold mb-4">Acceso de organizador pendiente</h2>
        <p className="text-muted-foreground mb-6">
          Tu solicitud para ser organizador está en revisión. Un administrador la aprobará pronto.
          Mientras tanto, puedes explorar el catálogo como estudiante.
        </p>
        <a href="/" className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">Ir al catálogo</a>
      </div>
    </div>
  );
}