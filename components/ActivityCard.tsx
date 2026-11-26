"use client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bookmark,
  Calendar,
  ExternalLink,
  MapPin,
  Share2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { Activity } from "@/lib/types/activity";
import { cn } from "@/lib/utils";
import {
  formatActivityType,
  getModalidadBadgeClass,
  getProximasSesiones,
  getTypeBadgeClass,
  isCursoTaller,
} from "@/lib/utils/activity";

interface ActivityCardProps {
  activity: Activity;
  onFavorite?: (id: string) => void;
  isFavorite?: boolean;
  variant?: "default" | "compact";
}

export function ActivityCard({
  activity,
  onFavorite,
  isFavorite,
  variant = "default",
}: ActivityCardProps) {
  const proximasSesiones = getProximasSesiones(activity);
  const primeraSesion = proximasSesiones[0];
  const esCT = isCursoTaller(activity);

  return (
    <Card
      className={cn(
        "flex flex-col h-full transition-shadow hover:shadow-md",
        variant === "compact" && "max-w-sm",
      )}
    >
      <CardContent className="flex flex-col flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge className={getTypeBadgeClass(activity.tipo)}>
            {formatActivityType(activity.tipo)}
          </Badge>
          <Badge
            variant="outline"
            className={getModalidadBadgeClass(activity.modalidad)}
          >
            {activity.modalidad}
          </Badge>
        </div>
        <h3 className="text-lg font-semibold text-foreground line-clamp-2 overflow-hidden">
          {activity.titulo}
        </h3>
        <div className="mt-1 flex-1 min-h-0">
          <p className="text-sm text-muted-foreground line-clamp-2 overflow-hidden">
            {activity.descripcion}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-3">
          {primeraSesion && (
            <>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {format(primeraSesion.fecha.toDate(), "dd MMM yyyy", {
                  locale: es,
                })}
              </span>
            </>
          )}
          {esCT && activity.sesiones.length > 1 && (
            <>
              <Bookmark className="h-3.5 w-3.5 shrink-0" />
              <span>{activity.sesiones.length} sesiones</span>
            </>
          )}
          {activity.sede && (
            <>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[120px]">{activity.sede}</span>
            </>
          )}
          {activity.enlaceVirtual && !activity.sede && (
            <>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span>Virtual</span>
            </>
          )}
          {activity.cupo && (
            <>
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>Cupo: {activity.cupo}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {activity.etiquetas.slice(0, 3).map((etiqueta) => (
            <Badge key={etiqueta} variant="secondary" className="text-xs">
              {etiqueta}
            </Badge>
          ))}
          {activity.etiquetas.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{activity.etiquetas.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2">
          {onFavorite && activity.id && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onFavorite(activity.id!)}
              className={cn("h-8 w-8", isFavorite && "text-primary")}
              aria-label={
                isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
              }
            >
              <Bookmark
                className={cn("h-4 w-4", isFavorite && "fill-current")}
              />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Compartir">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <Link
          href={`/actividad/${activity.id ?? ""}`}
          className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          Ver detalles
        </Link>
      </CardFooter>
    </Card>
  );
}
