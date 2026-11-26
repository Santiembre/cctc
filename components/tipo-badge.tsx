import type { ReactElement } from "react";
import { ETIQUETA_TIPO, type TipoActividad } from "@/lib/actividades";
import { cn } from "@/lib/utils";

const ESTILO_TIPO: Record<TipoActividad, string> = {
  taller: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
  curso:
    "bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200",
  club: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
};

export function TipoBadge({
  tipo,
  className,
}: {
  readonly tipo: TipoActividad;
  readonly className?: string;
}): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        ESTILO_TIPO[tipo],
        className,
      )}
    >
      {ETIQUETA_TIPO[tipo]}
    </span>
  );
}
