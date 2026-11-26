"use client";
import { useMemo } from "react";
import { ActivityDetail } from "@/components/ActivityDetail";
import { hydrateTimestamps } from "@/lib/firebase/hydrate";
import type { Activity } from "@/lib/types/activity";

interface ActivityDetailViewProps {
  /** Actividad serializada con `serializeTimestamps` en el servidor. */
  activity: unknown;
}

/** Reconstruye los Timestamp que mandó el servidor y pinta el detalle. */
export function ActivityDetailView({ activity }: ActivityDetailViewProps) {
  const hydrated = useMemo(
    () => hydrateTimestamps<Activity>(activity),
    [activity],
  );
  return <ActivityDetail activity={hydrated} />;
}
