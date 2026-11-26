// Esquema del formulario de revisión/publicación: lo valida el cliente (react-hook-form)
// y otra vez el servidor al publicar. Las fechas viajan como strings "YYYY-MM-DD".
import { z } from "zod";

const DIA_SEMANA_MIN = 0;
const DIA_SEMANA_MAX = 6;
const TITULO_MIN = 3;
const TITULO_MAX = 120;
const AREA_MIN = 2;
const AREA_MAX = 60;
const DESCRIPCION_MIN = 10;
const DESCRIPCION_MAX = 5000;
const SEDE_MAX = 120;
const REQUISITOS_MAX = 2000;

export const sesionFormSchema = z.object({
  fecha: z.string().min(1, "Fecha requerida"),
  horaInicio: z.string().min(1, "Hora inicio requerida"),
  horaFin: z.string().min(1, "Hora fin requerida"),
  tema: z.string().optional(),
  sede: z.string().optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal("")),
});

export const horarioFormSchema = z.object({
  diaSemana: z.number().int().min(DIA_SEMANA_MIN).max(DIA_SEMANA_MAX),
  horaInicio: z.string().min(1, "Hora inicio requerida"),
  horaFin: z.string().min(1, "Hora fin requerida"),
  sede: z.string().optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal("")),
});

// Sin .default() para que z.infer dé el tipo exacto que usa react-hook-form.
export const reviewFormSchema = z.object({
  titulo: z
    .string()
    .min(TITULO_MIN, `Mínimo ${TITULO_MIN} caracteres`)
    .max(TITULO_MAX),
  tipo: z.enum(["taller", "curso", "club"]),
  area: z.string().min(AREA_MIN, `Mínimo ${AREA_MIN} caracteres`).max(AREA_MAX),
  descripcion: z
    .string()
    .min(DESCRIPCION_MIN, `Mínimo ${DESCRIPCION_MIN} caracteres`)
    .max(DESCRIPCION_MAX),
  modalidad: z.enum(["presencial", "virtual", "hibrido"]),
  sede: z.string().max(SEDE_MAX).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal("")),
  cupo: z.number().int().positive().optional(),
  costo: z.number({ error: "Ingresa el costo (0 si es gratis)" }).nonnegative(),
  moneda: z.enum(["MXN", "USD", "GRATIS"]),
  requisitos: z.string().max(REQUISITOS_MAX).optional(),
  enlaceInscripcion: z.string().url().optional().or(z.literal("")),
  etiquetas: z.array(z.string()).optional(),
  sesiones: z.array(sesionFormSchema).optional(),
  horarios: z.array(horarioFormSchema).optional(),
  fechaInicio: z.string().min(1, "Indica la fecha de inicio"),
  fechaFin: z.string().optional(),
});

export type ReviewFormData = z.infer<typeof reviewFormSchema>;
