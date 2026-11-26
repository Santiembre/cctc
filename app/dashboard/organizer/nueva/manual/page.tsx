"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExtractionReviewForm } from "@/components/ExtractionReviewForm";
import { Button } from "@/components/ui/button";
import { hydrateTimestamps } from "@/lib/firebase/hydrate";
import type { Activity } from "@/lib/types/activity";

export default function NuevaActividadManualPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handlePublish = async (data: any) => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error creando actividad");

      router.push(`/dashboard/organizer/actividades?published=${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando actividad");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/organizer/nueva"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a subir archivo
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nueva actividad manual</h1>
          <p className="text-muted-foreground">Completa los campos manualmente para crear la actividad</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      <ExtractionReviewForm
        initialData={{}}
        confidence={{}}
        onSubmit={handlePublish}
        isSubmitting={submitting}
      />
    </div>
  );
}