"use client";
import { useMemo } from "react";
import { ActivityGrid } from "@/components/ActivityGrid";
import { hydrateTimestamps } from "@/lib/firebase/hydrate";
import type { Activity } from "@/lib/types/activity";

interface CatalogGridProps {
  /** Actividades serializadas con `serializeTimestamps` en el servidor. */
  activities: unknown[];
  pagination: { page: number; totalPages: number; total: number };
}

/** Reconstruye los Timestamp que mandó el servidor y pinta el catálogo. */
export function CatalogGrid({ activities, pagination }: CatalogGridProps) {
  const hydrated = useMemo(
    () => hydrateTimestamps<Activity[]>(activities),
    [activities],
  );
  return <ActivityGrid activities={hydrated} pagination={pagination} />;
}
