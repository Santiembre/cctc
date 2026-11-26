import { z } from "zod";
import { reviewFormSchema } from "@/lib/review-form";

const LIMITE_POR_PAGINA_MAX = 50;
const LIMITE_POR_PAGINA_DEFAULT = 20;

export const activityListQuerySchema = z.object({
  q: z.string().optional(),
  tipo: z.enum(["taller", "curso", "club"]).optional(),
  area: z.string().optional(),
  modalidad: z.enum(["presencial", "virtual", "hibrido"]).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  costo: z.enum(["gratis", "pago"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(LIMITE_POR_PAGINA_MAX)
    .default(LIMITE_POR_PAGINA_DEFAULT),
  sort: z.enum(["fechaAsc", "fechaDesc", "titulo"]).default("fechaAsc"),
});

export const publishRequestSchema = z.object({
  draftId: z.string().min(1),
  // Lo que el organizador revisó en el formulario; los campos obligatorios se validan aquí
  // también, porque el catálogo depende de ellos (p. ej. fechaInicio para ordenar).
  actividad: reviewFormSchema,
});

export const favoriteRequestSchema = z.object({
  actividadId: z.string().min(1),
});

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues;
    throw new Error(
      `VALIDATION_ERROR: ${issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`,
    );
  }
  return result.data;
}
