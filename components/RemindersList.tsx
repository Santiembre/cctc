"use client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Calendar, Clock, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Activity } from "@/lib/types/activity";
import {
  formatActivityType,
  getProximasSesiones,
  getTypeBadgeClass,
} from "@/lib/utils/activity";

interface ReminderItem {
  actividad: Activity;
  sesion: {
    fecha: any;
    horaInicio: string;
    horaFin: string;
    sede?: string;
    enlaceVirtual?: string;
  };
}

export function RemindersList() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In real implementation, fetch from user's reminders subcollection
    // For now, show upcoming sessions from favorites
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          Promise.all(
            data.data.map((f: any) =>
              fetch(`/api/activities/${f.actividadId}`).then((r) => r.json()),
            ),
          ).then((results) => {
            const activities = results.map((r) => r.data).filter(Boolean);
            const upcoming = activities
              .flatMap((a: Activity) =>
                getProximasSesiones(a).map((s) => ({
                  actividad: a,
                  sesion: s,
                })),
              )
              .sort(
                (a, b) => a.sesion.fecha.toMillis() - b.sesion.fecha.toMillis(),
              );
            setReminders(upcoming);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          No tienes recordatorios próximos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map(({ actividad: activity, sesion }) => (
        <Card key={`${activity.id}-${sesion.fecha.toMillis()}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeBadgeClass(activity.tipo)}>
                      {formatActivityType(activity.tipo)}
                    </Badge>
                    <h4 className="font-medium">{activity.titulo}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(sesion.fecha.toDate(), "EEEE dd MMMM yyyy", {
                      locale: es,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {sesion.horaInicio} - {sesion.horaFin}
                </span>
                {sesion.sede && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {sesion.sede}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
