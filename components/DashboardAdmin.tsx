"use client";
import {
  CheckCircle,
  Loader2,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Organizer {
  id: string;
  email: string;
  nombre: string;
  organizadorAprobado: boolean;
  createdAt: { toDate: () => Date };
}

interface Metrics {
  totalActivities: number;
  publishedActivities: number;
  draftActivities: number;
  totalUsers: number;
  totalExtractions: number;
  totalFavorites: number;
  byType: { tipo: string; count: number }[];
}

export function DashboardAdmin() {
  const [pendingOrganizers, setPendingOrganizers] = useState<Organizer[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/organizers?status=pending").then((r) => r.json()),
      fetch("/api/admin/metrics").then((r) => r.json()),
    ]).then(([organizersData, metricsData]) => {
      setPendingOrganizers(organizersData.data || []);
      setMetrics(metricsData.data || null);
      setLoading(false);
    });
  }, []);

  const handleOrganizerAction = async (
    uid: string,
    action: "approve" | "reject",
  ) => {
    setActionLoading(uid);
    try {
      await fetch("/api/admin/organizers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, action }),
      });
      setPendingOrganizers((prev) => prev.filter((o) => o.id !== uid));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Desconocido"}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Panel de administración</h1>
        <p className="text-muted-foreground">
          Gestión de organizadores y métricas de la plataforma
        </p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard
            title="Actividades totales"
            value={metrics.totalActivities}
            icon={TrendingUp}
          />
          <MetricCard
            title="Publicadas"
            value={metrics.publishedActivities}
            icon={CheckCircle}
            className="text-green-600"
          />
          <MetricCard
            title="Borradores"
            value={metrics.draftActivities}
            icon={Loader2}
            className="text-amber-600"
          />
          <MetricCard
            title="Usuarios"
            value={metrics.totalUsers}
            icon={UserPlus}
          />
          <MetricCard
            title="Extracciones IA"
            value={metrics.totalExtractions}
            icon={TrendingUp}
            className="text-purple-600"
          />
          <MetricCard
            title="Favoritos"
            value={metrics.totalFavorites}
            icon={TrendingUp}
            className="text-red-600"
          />
        </div>
      )}

      <Tabs defaultValue="organizadores" className="w-full">
        <TabsList>
          <TabsTrigger value="organizadores">
            Organizadores pendientes
          </TabsTrigger>
          <TabsTrigger value="metricas">Métricas detalladas</TabsTrigger>
        </TabsList>

        <TabsContent value="organizadores">
          {pendingOrganizers.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No hay organizadores pendientes de aprobación
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingOrganizers.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{org.nombre}</p>
                    <p className="text-sm text-muted-foreground">{org.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado:{" "}
                      {org.createdAt.toDate().toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOrganizerAction(org.id, "approve")}
                      disabled={actionLoading === org.id}
                    >
                      {actionLoading === org.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4 mr-1" />
                      )}
                      Aprobar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleOrganizerAction(org.id, "reject")}
                      disabled={actionLoading === org.id}
                    >
                      {actionLoading === org.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserX className="h-4 w-4 mr-1" />
                      )}
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="metricas">
          {metrics && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">
                  Actividades por tipo
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  {metrics.byType.map((item) => (
                    <div key={item.tipo} className="p-4 rounded-lg border">
                      <p className="text-3xl font-bold">{item.count}</p>
                      <p className="text-muted-foreground capitalize">
                        {item.tipo}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className="p-4 rounded-lg border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold {className}">
            {value.toLocaleString()}
          </p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
    </div>
  );
}
