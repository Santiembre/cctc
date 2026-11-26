"use client";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityCard } from "@/components/ActivityCard";
import { Button } from "@/components/ui/button";

interface DraftActivity {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  createdAt: { toDate: () => Date };
  updatedAt: { toDate: () => Date };
}

export default function BorradoresPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activities?estado=borrador&organizadorId=me")
      .then((r) => r.json())
      .then((data) => {
        setDrafts(data.activities || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Mis borradores</h1>
            <p className="text-muted-foreground">
              Actividades extraídas por IA pendientes de revisión
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/organizer/nueva"
          className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <FileText className="h-4 w-4 mr-2" />+ Nueva desde archivo
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No tienes borradores aún</p>
          <Link
            href="/dashboard/organizer/nueva"
            className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Crear primer borrador
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((draft) => (
            <ActivityCard
              key={draft.id}
              activity={draft as any}
              variant="compact"
            />
          ))}
        </div>
      )}
    </div>
  );
}
