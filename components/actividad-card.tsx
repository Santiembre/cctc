"use client";

import { CalendarDays, Clock, Heart, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { TipoBadge } from "@/components/tipo-badge";
import {
  type Actividad,
  formatearCosto,
  formatearRango,
  lugaresDisponibles,
} from "@/lib/actividades";
import { alternarFavorito } from "@/lib/store";
import { cn } from "@/lib/utils";

const POCOS_LUGARES = 5;

export function EstadoCupo({
  actividad,
}: {
  readonly actividad: Actividad;
}): ReactElement {
  const lugares = lugaresDisponibles(actividad);
  if (lugares === null) {
    return <span className="text-muted-foreground">Sin límite de cupo</span>;
  }
  if (lugares === 0) {
    return <span className="font-medium text-destructive">Cupo lleno</span>;
  }
  return (
    <span
      className={cn(
        "font-medium",
        lugares <= POCOS_LUGARES
          ? "text-amber-700 dark:text-amber-300"
          : "text-foreground",
      )}
    >
      {lugares === 1 ? "Queda 1 lugar" : `${lugares} lugares`}
    </span>
  );
}

export function BotonFavorito({
  id,
  activo,
  className,
}: {
  readonly id: string;
  readonly activo: boolean;
  readonly className?: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={() => alternarFavorito(id)}
      aria-pressed={activo}
      aria-label={activo ? "Quitar de favoritos" : "Guardar en favoritos"}
      title={activo ? "Quitar de favoritos" : "Guardar en favoritos"}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
        activo ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
        className,
      )}
    >
      <Heart className={cn("size-5", activo && "fill-current")} aria-hidden />
    </button>
  );
}

export function ActividadCard({
  actividad,
  favorito,
}: {
  readonly actividad: Actividad;
  readonly favorito: boolean;
}): ReactElement {
  const {
    id,
    titulo,
    tipo,
    area,
    fechaInicio,
    fechaFin,
    horario,
    sede,
    modalidad,
  } = actividad;

  return (
    <article className="group relative flex flex-col rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TipoBadge tipo={tipo} />
          <span className="text-xs text-muted-foreground">{area}</span>
        </div>
        <BotonFavorito
          id={id}
          activo={favorito}
          className="relative z-10 -mt-1.5 -mr-2"
        />
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug text-balance">
        <Link
          href={`/actividad/${id}`}
          className="outline-none after:absolute after:inset-0 after:rounded-2xl"
        >
          {titulo}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {actividad.organizador}
      </p>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Fechas</dt>
          <CalendarDays
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <dd>{formatearRango(fechaInicio, fechaFin)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Horario</dt>
          <Clock
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <dd>{horario}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Lugar</dt>
          <MapPin
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <dd className="truncate">
            <span className="capitalize">{modalidad}</span> · {sede}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-sm [margin-block-start:max(auto,1.25rem)]">
        <span className="font-semibold">{formatearCosto(actividad.costo)}</span>
        <div className="flex items-center gap-3">
          {actividad.origen === "ia" && (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              title="Ficha generada con IA a partir del cartel y revisada por el organizador"
            >
              <Sparkles className="size-3.5" aria-hidden />
              IA
            </span>
          )}
          <EstadoCupo actividad={actividad} />
        </div>
      </div>
    </article>
  );
}
