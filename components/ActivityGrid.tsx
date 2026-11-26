"use client";
import Link from "next/link";
import { ActivityCard } from "@/components/ActivityCard";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/lib/types/activity";

interface ActivityGridProps {
  activities: Activity[];
  pagination?: { page: number; totalPages: number; total: number };
  showFavorites?: boolean;
  onFavorite?: (id: string) => void;
  favoriteIds?: Set<string>;
}

export function ActivityGrid({
  activities,
  pagination,
  showFavorites,
  onFavorite,
  favoriteIds = new Set(),
}: ActivityGridProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          No se encontraron actividades
        </p>
        {showFavorites && (
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Explorar catálogo
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onFavorite={onFavorite}
            isFavorite={favoriteIds.has(activity.id ?? "")}
          />
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() =>
              window.history.pushState(null, "", `?page=${pagination.page - 1}`)
            }
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages} (
            {pagination.total} resultados)
          </span>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() =>
              window.history.pushState(null, "", `?page=${pagination.page + 1}`)
            }
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
