import { cn } from '@/lib/utils';
import type { Activity, CursoTaller, Club } from '@/lib/types/activity';
import { Timestamp } from 'firebase/firestore';

export function isCursoTaller(activity: Activity): activity is CursoTaller {
  return activity.tipo === 'curso' || activity.tipo === 'taller';
}

export function isClub(activity: Activity): activity is Club {
  return activity.tipo === 'club';
}

export function getFechaInicio(activity: Activity): Timestamp {
  return activity.fechaInicio;
}

export function getFechaFin(activity: Activity): Timestamp | undefined {
  if (isCursoTaller(activity)) return activity.fechaFin;
  return activity.fechaFin;
}

export function getProximasSesiones(activity: Activity, limit = 3) {
  if (isCursoTaller(activity)) {
    return activity.sesiones
      .filter((s) => s.fecha.toMillis() >= Date.now())
      .sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())
      .slice(0, limit);
  }
  return [];
}

export function formatActivityType(tipo: Activity['tipo']): string {
  const labels = { taller: 'Taller', curso: 'Curso', club: 'Club' };
  return labels[tipo];
}

export function getTypeBadgeClass(tipo: Activity['tipo']): string {
  const classes = {
    taller: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    curso: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    club: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', classes[tipo]);
}

export function getModalidadBadgeClass(modalidad: Activity['modalidad']): string {
  const classes = {
    presencial: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
    virtual: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    hibrido: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', classes[modalidad]);
}