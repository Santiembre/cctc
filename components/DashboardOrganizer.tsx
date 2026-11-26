"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityGrid } from "@/components/ActivityGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OrganizerActivity {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  fechaInicio: { toDate: () => Date };
  createdAt: { toDate: () => Date };
}

export function DashboardOrganizer() {
  const _router = useRouter();
  const [activeTab, setActiveTab] = useState<"publicadas" | "archivadas">(
    "publicadas",
  );
  const [activities, setActivities] = useState<OrganizerActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `/api/activities?organizadorId=me&estado=${activeTab === "publicadas" ? "publicado" : "archivado"}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setActivities(data.activities || []);
        setLoading(false);
      });
  }, [activeTab]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis actividades</h1>
          <p className="text-muted-foreground">
            Gestiona tus actividades publicadas y archivadas
          </p>
        </div>
        <Link
          href="/dashboard/organizer/nueva"
          className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          + Nueva actividad
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="publicadas">Publicadas</TabsTrigger>
          <TabsTrigger value="archivadas">Archivadas</TabsTrigger>
        </TabsList>

        <TabsContent value="publicadas">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No tienes actividades publicadas
              </p>
              <Link
                href="/dashboard/organizer/nueva"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Crear primera actividad
              </Link>
            </div>
          ) : (
            <ActivityGrid activities={activities as any} />
          )}
        </TabsContent>

        <TabsContent value="archivadas">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No tienes actividades archivadas
              </p>
            </div>
          ) : (
            <ActivityGrid activities={activities as any} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
