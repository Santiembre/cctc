import { z } from 'zod';

export const activityListQuerySchema = z.object({
  q: z.string().optional(),
  tipo: z.enum(['taller', 'curso', 'club']).optional(),
  area: z.string().optional(),
  modalidad: z.enum(['presencial', 'virtual', 'hibrido']).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  costo: z.enum(['gratis', 'pago']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  sort: z.enum(['fechaAsc', 'fechaDesc', 'titulo']).default('fechaAsc'),
});

export const signedUrlRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
});

export const extractRequestSchema = z.object({
  filePath: z.string().min(1),
});

export const publishRequestSchema = z.object({
  draftId: z.string().min(1),
});

export const favoriteRequestSchema = z.object({
  actividadId: z.string().min(1),
});

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues;
    throw new Error(`VALIDATION_ERROR: ${issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
  }
  return result.data;
}