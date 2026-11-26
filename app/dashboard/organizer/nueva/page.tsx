"use client";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExtractionReviewForm } from "@/components/ExtractionReviewForm";
import { UploadZone } from "@/components/UploadZone";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/lib/types/activity";

// Convertir Activity (con Timestamp) a ReviewFormData (con strings)
function convertToReviewFormData(
  activity: Partial<Activity>,
): Partial<Record<string, any>> {
  const result: Partial<Record<string, any>> = { ...activity };

  // Convertir fechas a strings YYYY-MM-DD
  if (
    activity.fechaInicio &&
    typeof activity.fechaInicio === "object" &&
    "toDate" in activity.fechaInicio
  ) {
    result.fechaInicio = activity.fechaInicio
      .toDate()
      .toISOString()
      .split("T")[0];
  }
  if (
    activity.fechaFin &&
    typeof activity.fechaFin === "object" &&
    "toDate" in activity.fechaFin
  ) {
    result.fechaFin = activity.fechaFin.toDate().toISOString().split("T")[0];
  }

  // Convertir sesiones (usar type guard)
  const act = activity as any;
  if (act.sesiones) {
    result.sesiones = act.sesiones.map((s: any) => ({
      ...s,
      fecha:
        s.fecha && typeof s.fecha === "object" && "toDate" in s.fecha
          ? s.fecha.toDate().toISOString().split("T")[0]
          : s.fecha,
    }));
  }

  return result;
}

export default function NuevaActividadPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [extractionData, setExtractionData] = useState<{
    draftId: string;
    actividad: Partial<Activity>;
    confianza: Record<string, number>;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleUploadComplete = async (filePath: string, _fileType: string) => {
    try {
      const response = await fetch("/api/activities/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error en extracción");

      setExtractionData({
        draftId: result.draftId,
        actividad: result.actividad,
        confianza: result.confianza,
      });
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error procesando archivo");
    }
  };

  const handlePublish = async (_data: any) => {
    setSubmitting(true);
    setError("");
    try {
      if (!extractionData) throw new Error("No hay datos de extracción");

      const response = await fetch("/api/activities/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: extractionData.draftId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error publicando");

      router.push(`/dashboard/organizer/actividades?published=${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error publicando");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "upload") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              Nueva actividad desde archivo
            </h1>
            <p className="text-muted-foreground">
              Sube un PDF o imagen del cartel y la IA extraerá la información
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <UploadZone
            onUploadComplete={handleUploadComplete}
            onError={setError}
          />

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>¿Prefieres ingresar los datos manualmente?</p>
          <Link
            href="/dashboard/organizer/nueva/manual"
            className="text-primary underline"
          >
            Crear actividad manualmente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setStep("upload")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Revisar y publicar</h1>
          <p className="text-muted-foreground">
            La IA ha extraído la información. Revisa, corrige y publica.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <ExtractionReviewForm
        initialData={
          extractionData
            ? convertToReviewFormData(extractionData.actividad)
            : {}
        }
        confidence={extractionData!.confianza}
        onSubmit={handlePublish}
        isSubmitting={submitting}
      />
    </div>
  );
}
