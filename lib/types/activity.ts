import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Esquema base de actividad compartido por todos los tipos
export const activityBaseSchema = z.object({
  id: z.string().optional(),
  titulo: z.string().min(3).max(120),
  tipo: z.enum(['taller', 'curso', 'club']),
  area: z.string().min(2).max(60),
  descripcion: z.string().min(10).max(5000),
  modalidad: z.enum(['presencial', 'virtual', 'hibrido']),
  sede: z.string().max(120).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
  cupo: z.number().int().positive().optional(),
  costo: z.number().nonnegative().default(0),
  moneda: z.enum(['MXN', 'USD', 'GRATIS']).default('GRATIS'),
  requisitos: z.string().max(2000).optional(),
  organizadorId: z.string(),
  organizadorNombre: z.string(),
  enlaceInscripcion: z.string().url().optional().or(z.literal('')),
  etiquetas: z.array(z.string()).default([]),
  estado: z.enum(['borrador', 'publicado', 'archivado', 'rechazado']).default('borrador'),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
  publishedAt: z.custom<Timestamp>().optional(),
});

// Curso/Taller específico: array de sesiones
export const sesionSchema = z.object({
  fecha: z.custom<Timestamp>(),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  tema: z.string().max(120).optional(),
  sede: z.string().max(120).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
});

export const cursoTallerSchema = activityBaseSchema.extend({
  sesiones: z.array(sesionSchema).min(1),
  fechaInicio: z.custom<Timestamp>(),
  fechaFin: z.custom<Timestamp>(),
}).refine((data) => data.tipo === 'curso' || data.tipo === 'taller', {
  message: 'Solo para cursos y talleres',
});

// Club específico: horarios recurrentes
export const horarioRecurrenteSchema = z.object({
  diaSemana: z.number().int().min(0).max(6), // 0=Domingo
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  sede: z.string().max(120).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
});

export const clubSchema = activityBaseSchema.extend({
  horarios: z.array(horarioRecurrenteSchema).min(1),
  fechaInicio: z.custom<Timestamp>(), // Cuándo inicia el club
  fechaFin: z.custom<Timestamp>().optional(), // Fecha fin opcional
}).refine((data) => data.tipo === 'club', {
  message: 'Solo para clubes',
});

export const activitySchema = z.discriminatedUnion('tipo', [
  cursoTallerSchema,
  clubSchema,
]);

export type ActivityBase = z.infer<typeof activityBaseSchema>;
export type CursoTaller = z.infer<typeof cursoTallerSchema>;
export type Club = z.infer<typeof clubSchema>;
export type Activity = z.infer<typeof activitySchema>;

// Resultado de extracción de IA - esquema sin refinamientos para permitir partial
const cursoTallerPartialSchema = activityBaseSchema.partial().extend({
  sesiones: z.array(sesionSchema).optional(),
  fechaInicio: z.custom<Timestamp>().optional(),
  fechaFin: z.custom<Timestamp>().optional(),
});

const clubPartialSchema = activityBaseSchema.partial().extend({
  horarios: z.array(horarioRecurrenteSchema).optional(),
  fechaInicio: z.custom<Timestamp>().optional(),
  fechaFin: z.custom<Timestamp>().optional(),
});

export const extractionSchema = z.object({
  actividad: z.union([cursoTallerPartialSchema, clubPartialSchema]),
  confianza: z.record(z.string(), z.number().min(0).max(1)), // campo -> confianza 0-1
  camposFaltantes: z.array(z.string()),
  textoCrudo: z.string(),
  archivoPath: z.string(),
  createdAt: z.custom<Timestamp>(),
});

export type Extraction = z.infer<typeof extractionSchema>;

// Perfil de usuario
export const userProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  nombre: z.string().max(100),
  carrera: z.string().max(100).optional(),
  rol: z.enum(['estudiante', 'organizador', 'admin']).default('estudiante'),
  organizadorAprobado: z.boolean().default(false),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;