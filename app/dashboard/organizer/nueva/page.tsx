"use client";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExtractionReviewForm } from "@/components/ExtractionReviewForm";
import { UploadZone } from "@/components/UploadZone";
import { Button } from "@/components/ui/button";
import { hydrateTimestamps } from "@/lib/firebase/hydrate";
import type { ReviewFormData } from "@/lib/review-form";
import type { Activity } from "@/lib/types/activity";

interface ConToDate {
  toDate(): Date;
}

function tieneToDate(valor: unknown): valor is ConToDate {
  return typeof valor === "object" && valor !== null && "toDate" in valor;
}

/** Timestamp → "YYYY-MM-DD" para un <input type="date">; undefined si no es fecha. */
function fechaAString(valor: unknown): string | undefined {
  if (!tieneToDate(valor)) return undefined;
  const [fecha] = valor.toDate().toISOString().split("T");
  return fecha;
}

// Activity (fechas como Timestamp) → valores iniciales del formulario (fechas como string).
// Las fechas que faltan se omiten para que el formulario las pida.
function convertToReviewFormData(
  activity: Partial<Activity>,
): Partial<ReviewFormData> {
  const datos: Record<string, unknown> = { ...activity };
  const fechaInicio = fechaAString(datos.fechaInicio);
  const fechaFin = fechaAString(datos.fechaFin);
  const sesiones = Array.isArray(datos.sesiones)
    ? datos.sesiones.map((sesion: unknown) => {
        if (typeof sesion !== "object" || sesion === null) return sesion;
        const fecha =
          "fecha" in sesion ? fechaAString(sesion.fecha) : undefined;
        return { ...sesion, fecha: fecha ?? "" };
      })
    : undefined;
  const {
    fechaInicio: _inicio,
    fechaFin: _fin,
    sesiones: _sesiones,
    ...resto
  } = datos;
  // Los datos vienen de Firestore sin validar; el formulario los valida con reviewFormSchema.
  return {
    ...resto,
    ...(fechaInicio ? { fechaInicio } : {}),
    ...(fechaFin ? { fechaFin } : {}),
    ...(sesiones ? { sesiones } : {}),
  } as Partial<ReviewFormData>;
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

  // El archivo va directo a la API (multipart) y de ahí a Gemini; no pasa por Cloud Storage.
  // Si falla, se lanza el error para que UploadZone lo muestre y permita reintentar.
  const handleProcessFile = async (file: File, _fileType: string) => {
    setError("");
    const formData = new FormData();
    formData.append("archivo", file);

    const response = await fetch("/api/activities/extract", {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Error en extracción");

    // La API responde { success, data: {...} } y manda las fechas como { __timestamp }.
    const { draftId, actividad, confianza } = result.data;
    setExtractionData({
      draftId,
      actividad: hydrateTimestamps<Partial<Activity>>(actividad),
      confianza,
    });
    setStep("review");
  };

  const handlePublish = async (datos: ReviewFormData): Promise<void> => {
    setSubmitting(true);
    setError("");
    try {
      if (!extractionData) throw new Error("No hay datos de extracción");

      const response = await fetch("/api/activities/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: extractionData.draftId,
          actividad: datos,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error publicando");

      router.push(
        `/dashboard/organizer/actividades?published=${result.data.id}`,
      );
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
          <UploadZone onProcessFile={handleProcessFile} />

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
        <div className="mt-8" />
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
        confidence={extractionData?.confianza ?? {}}
        onSubmit={handlePublish}
        isSubmitting={submitting}
      />
    </div>
  );
}
