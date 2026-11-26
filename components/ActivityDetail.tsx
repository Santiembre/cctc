"use client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  Bookmark,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin,
  Share2,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Activity } from "@/lib/types/activity";
import { cn } from "@/lib/utils";
import {
  formatActivityType,
  getModalidadBadgeClass,
  getProximasSesiones,
  getTypeBadgeClass,
  isClub,
  isCursoTaller,
} from "@/lib/utils/activity";

interface ActivityDetailProps {
  activity: Activity;
}

export function ActivityDetail({ activity }: ActivityDetailProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const proximasSesiones = getProximasSesiones(activity);
  const esCT = isCursoTaller(activity);
  const esClub = isClub(activity);

  const toggleFavorite = async () => {
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actividadId: activity.id }),
      });
      if (response.ok) setIsFavorite((prev) => !prev);
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className={getTypeBadgeClass(activity.tipo)}>
              {formatActivityType(activity.tipo)}
            </Badge>
            <Badge
              variant="outline"
              className={getModalidadBadgeClass(activity.modalidad)}
            >
              {activity.modalidad}
            </Badge>
            {activity.estado === "publicado" && (
              <Badge
                variant="default"
                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              >
                <CheckCircle className="h-3 w-3 mr-1" /> Publicado
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {activity.titulo}
          </h1>
          <p className="text-muted-foreground mt-1">{activity.area}</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFavorite}
            aria-label={
              isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
            }
          >
            <Bookmark
              className={cn(
                "h-4 w-4",
                isFavorite && "fill-current text-primary",
              )}
            />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Compartir">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground whitespace-pre-wrap">
            {activity.descripcion}
          </p>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Fechas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Fechas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {esCT && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Inicio:</span>
                  <span>
                    {format(activity.fechaInicio.toDate(), "dd MMMM yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Fin:</span>
                  <span>
                    {format(activity.fechaFin.toDate(), "dd MMMM yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Sesiones:</span>
                  <span>{activity.sesiones.length}</span>
                </div>
              </>
            )}
            {esClub && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Inicio:</span>
                  <span>
                    {format(activity.fechaInicio.toDate(), "dd MMMM yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>
                {activity.fechaFin && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Fin:</span>
                    <span>
                      {format(activity.fechaFin.toDate(), "dd MMMM yyyy", {
                        locale: es,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Horarios:</span>
                  <span>{activity.horarios.length}</span>
                </div>
              </>
            )}
            {proximasSesiones.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Próximas sesiones</p>
                {proximasSesiones.slice(0, 3).map((sesion) => (
                  <div
                    key={`${sesion.fecha.toMillis()}-${sesion.horaInicio}`}
                    className="text-sm flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(sesion.fecha.toDate(), "dd MMM", { locale: es })}
                    </span>
                    <span className="text-muted-foreground">
                      {sesion.horaInicio} - {sesion.horaFin}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ubicación / Modalidad */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Ubicación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.sede && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{activity.sede}</span>
              </div>
            )}
            {activity.enlaceVirtual && (
              <div className="flex items-start gap-2 text-sm">
                <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5" />
                <a
                  href={activity.enlaceVirtual}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {activity.enlaceVirtual}
                </a>
              </div>
            )}
            {!activity.sede && !activity.enlaceVirtual && (
              <p className="text-sm text-muted-foreground">Por definir</p>
            )}
          </CardContent>
        </Card>

        {/* Cupo y Costo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Cupo y costo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Cupo:</span>
              <span>{activity.cupo ? activity.cupo : "Sin límite"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Costo:</span>
              <span className={activity.costo === 0 ? "text-green-600" : ""}>
                {activity.costo === 0
                  ? "Gratis"
                  : `${activity.costo} ${activity.moneda}`}
              </span>
            </div>
            {activity.requisitos && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-1">Requisitos</p>
                <p className="text-sm">{activity.requisitos}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Horarios detallados para cursos/clubes */}
      {(esCT || esClub) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />{" "}
              {esCT ? "Sesiones" : "Horarios recurrentes"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {esCT ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Fecha</th>
                      <th className="pb-2 pr-4">Hora</th>
                      <th className="pb-2 pr-4">Tema</th>
                      <th className="pb-2">Sede / Enlace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.sesiones.map((sesion) => (
                      <tr
                        key={`${sesion.fecha.toMillis()}-${sesion.horaInicio}`}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-4">
                          {format(sesion.fecha.toDate(), "dd MMM yyyy", {
                            locale: es,
                          })}
                        </td>
                        <td className="py-2 pr-4">
                          {sesion.horaInicio} - {sesion.horaFin}
                        </td>
                        <td className="py-2 pr-4">{sesion.tema || "-"}</td>
                        <td className="py-2">
                          {sesion.sede || sesion.enlaceVirtual || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activity.horarios.map((horario) => (
                  <div
                    key={`${horario.diaSemana}-${horario.horaInicio}`}
                    className="p-3 rounded-lg border"
                  >
                    <div className="font-medium">
                      {
                        ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
                          horario.diaSemana
                        ]
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {horario.horaInicio} - {horario.horaFin}
                    </div>
                    {horario.sede && (
                      <div className="text-sm text-muted-foreground">
                        {horario.sede}
                      </div>
                    )}
                    {horario.enlaceVirtual && (
                      <a
                        href={horario.enlaceVirtual}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Enlace virtual
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etiquetas */}
      {activity.etiquetas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Etiquetas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activity.etiquetas.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inscripción */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">¿Te interesa esta actividad?</h3>
              <p className="text-sm text-muted-foreground">
                Inscríbete directamente desde el enlace del organizador
              </p>
            </div>
            {activity.enlaceInscripcion ? (
              <Link
                href={activity.enlaceInscripcion}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Inscribirme ahora
              </Link>
            ) : (
              <Button variant="outline" size="lg" disabled>
                <AlertCircle className="h-4 w-4 mr-2" />
                Sin enlace de inscripción
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organizador info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Organizador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{activity.organizadorNombre}</p>
        </CardContent>
      </Card>
    </div>
  );
}
