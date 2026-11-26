'use client';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Link2, AlertCircle } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

// Esquema simplificado para el formulario de revisión
const sesionFormSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  horaInicio: z.string().min(1, 'Hora inicio requerida'),
  horaFin: z.string().min(1, 'Hora fin requerida'),
  tema: z.string().optional(),
  sede: z.string().optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
});

const horarioFormSchema = z.object({
  diaSemana: z.number().int().min(0).max(6),
  horaInicio: z.string().min(1, 'Hora inicio requerida'),
  horaFin: z.string().min(1, 'Hora fin requerida'),
  sede: z.string().optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
});

const reviewFormSchema = z.object({
  titulo: z.string().min(3, 'Mínimo 3 caracteres').max(120),
  tipo: z.enum(['taller', 'curso', 'club']),
  area: z.string().min(2, 'Mínimo 2 caracteres').max(60),
  descripcion: z.string().min(10, 'Mínimo 10 caracteres').max(5000),
  modalidad: z.enum(['presencial', 'virtual', 'hibrido']),
  sede: z.string().max(120).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
  cupo: z.number().int().positive().optional(),
  costo: z.number().nonnegative().default(0),
  moneda: z.enum(['MXN', 'USD', 'GRATIS']).default('GRATIS'),
  requisitos: z.string().max(2000).optional(),
  enlaceInscripcion: z.string().url().optional().or(z.literal('')),
  etiquetas: z.array(z.string()).default([]),
  sesiones: z.array(sesionFormSchema).optional(),
  horarios: z.array(horarioFormSchema).optional(),
  fechaInicio: z.string().min(1, 'Fecha inicio requerida'),
  fechaFin: z.string().optional(),
});

type ReviewFormData = z.infer<typeof reviewFormSchema>;

interface ExtractionReviewFormProps {
  initialData: Partial<ReviewFormData>;
  confidence: Record<string, number>;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function ExtractionReviewForm({ initialData, confidence, onSubmit, isSubmitting }: ExtractionReviewFormProps) {
  const [tipo, setTipo] = useState(initialData.tipo || 'taller');
  const isCursoTaller = tipo === 'curso' || tipo === 'taller';

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      titulo: '',
      tipo: 'taller',
      area: '',
      descripcion: '',
      modalidad: 'presencial',
      costo: 0,
      moneda: 'GRATIS',
      etiquetas: [],
      sesiones: [{ fecha: new Date().toISOString().split('T')[0], horaInicio: '09:00', horaFin: '11:00' }],
      horarios: [{ diaSemana: 1, horaInicio: '16:00', horaFin: '18:00' }],
      fechaInicio: new Date().toISOString().split('T')[0],
      ...initialData,
    },
    mode: 'onChange',
  });

  const { fields: sesionesFields, append: appendSesion, remove: removeSesion } = useFieldArray({ control: form.control, name: 'sesiones' });
  const { fields: horariosFields, append: appendHorario, remove: removeHorario } = useFieldArray({ control: form.control, name: 'horarios' });
  const { fields: etiquetasFields, append: appendEtiqueta, remove: removeEtiqueta } = useFieldArray({ control: form.control, name: 'etiquetas' });

  const getConfidence = (field: string) => confidence[field] ?? 1;
  const getConfidenceClass = (field: string) => {
    const c = getConfidence(field);
    if (c >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (c >= 0.5) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  const handleTipoChange = (value: string) => {
    setTipo(value as ReviewFormData['tipo']);
    form.setValue('tipo', value as ReviewFormData['tipo'], { shouldValidate: true });
    if (value === 'club') {
      form.setValue('sesiones', undefined);
      form.setValue('fechaFin', '');
    } else {
      form.setValue('horarios', undefined);
      form.setValue('fechaFin', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    }
  };

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...form.getValues(),
        ...initialData,
      });
    }
  }, [initialData, form]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-lg border p-4 bg-muted/50">
        <h3 className="font-medium mb-3">Tipo de actividad</h3>
        <div className="flex gap-3">
          {(['taller', 'curso', 'club'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={tipo === t ? 'default' : 'outline'}
              onClick={() => handleTipoChange(t)}
              className="flex-1"
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="titulo"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Título *</label>
              <Input {...field} placeholder="Título de la actividad" />
              {getConfidence('titulo') < 1 && (
                <Badge className={cn('mt-1', getConfidenceClass('titulo'))} variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Confianza: {Math.round(getConfidence('titulo') * 100)}%
                </Badge>
              )}
            </div>
          )}
        />
        <Controller
          name="area"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Área *</label>
              <Select
                value={field.value || ''}
                onValueChange={(v) => field.onChange(v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                <SelectContent>
                  {['Programación', 'Diseño', 'Ciencias', 'Humanidades', 'Idiomas', 'Deportes', 'Artes', 'Emprendimiento', 'Otro'].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      <Controller
        name="descripcion"
        control={form.control}
        render={({ field }) => (
          <div>
            <label className="block text-sm font-medium mb-1">Descripción *</label>
            <Textarea {...field} rows={4} placeholder="Describe la actividad..." />
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="modalidad"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Modalidad *</label>
              <Select value={field.value || 'presencial'} onValueChange={(v) => field.onChange(v)}>
                <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        />
        <Controller
          name="costo"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Costo</label>
              <Input type="number" min="0" step="1" {...field} placeholder="0" />
            </div>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="sede"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                Sede <MapPin className="h-3.5 w-3.5" />
              </label>
              <Input {...field} placeholder="Edificio, aula, campus" />
            </div>
          )}
        />
        <Controller
          name="enlaceVirtual"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                Enlace virtual <Link2 className="h-3.5 w-3.5" />
              </label>
              <Input type="url" {...field} placeholder="https://meet.google.com/..." />
            </div>
          )}
        />
      </div>

      {isCursoTaller ? (
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Sesiones
          </h4>
          {sesionesFields.map((sesion, index) => (
            <div key={sesion.id} className="grid gap-3 sm:grid-cols-4 items-end">
              <Controller
                name={`sesiones.${index}.fecha`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha</label>
                    <Input type="date" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`sesiones.${index}.horaInicio`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Hora inicio</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`sesiones.${index}.horaFin`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Hora fin</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <div className="flex items-end">
                <Controller
                  name={`sesiones.${index}.tema`}
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">Tema (opcional)</label>
                      <Input {...field} placeholder="Tema de la sesión" />
                    </div>
                  )}
                />
              </div>
              <div className="flex items-end">
                <Controller
                  name={`sesiones.${index}.sede`}
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">Sede (opcional)</label>
                      <Input {...field} placeholder="Edificio, aula" />
                    </div>
                  )}
                />
              </div>
              <div className="flex items-end">
                <Controller
                  name={`sesiones.${index}.enlaceVirtual`}
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">Enlace virtual (opcional)</label>
                      <Input type="url" {...field} placeholder="https://meet.google.com/..." />
                    </div>
                  )}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSesion(index)} disabled={sesionesFields.length === 1}>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendSesion({ fecha: new Date().toISOString().split('T')[0], horaInicio: '09:00', horaFin: '11:00' })}>
            + Agregar sesión
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horarios recurrentes
          </h4>
          {horariosFields.map((horario, index) => (
            <div key={horario.id} className="grid gap-3 sm:grid-cols-5 items-end">
              <Controller
                name={`horarios.${index}.diaSemana`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Día</label>
                    <Select value={String(field.value ?? '')} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Día" /></SelectTrigger>
                      <SelectContent>
                        {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((d, i) => (
                          <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.horaInicio`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Inicio</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.horaFin`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Fin</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.sede`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Sede</label>
                    <Input {...field} placeholder="Edificio, aula" />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.enlaceVirtual`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Enlace virtual</label>
                    <Input type="url" {...field} placeholder="https://meet.google.com/..." />
                  </div>
                )}
              />
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeHorario(index)} disabled={horariosFields.length === 1}>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendHorario({ diaSemana: 1, horaInicio: '16:00', horaFin: '18:00' })}>
            + Agregar horario
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Etiquetas</label>
        <div className="flex flex-wrap gap-2">
          {etiquetasFields.map((etiqueta, index) => (
            <Badge key={etiqueta.id} variant="secondary" className="gap-1">
              <Controller
                name={`etiquetas.${index}`}
                control={form.control}
                render={({ field }) => <Input {...field} className="bg-transparent border-0 py-0 h-6 text-sm" placeholder="Etiqueta" />}
              />
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeEtiqueta(index)}>
                <AlertCircle className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendEtiqueta('')}>
            + Etiqueta
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="cupo"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Cupo máximo</label>
              <Input type="number" min="1" {...field} placeholder="Sin límite" />
            </div>
          )}
        />
        <Controller
          name="enlaceInscripcion"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Enlace de inscripción</label>
              <Input type="url" {...field} placeholder="https://forms.gle/..." />
            </div>
          )}
        />
      </div>

      <Controller
        name="requisitos"
        control={form.control}
        render={({ field }) => (
          <div>
            <label className="block text-sm font-medium mb-1">Requisitos</label>
            <Textarea {...field} rows={3} placeholder="Conocimientos previos, materiales necesarios..." />
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="fechaInicio"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de inicio *</label>
              <Input type="date" {...field} />
            </div>
          )}
        />
        <Controller
          name="fechaFin"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de fin</label>
              <Input type="date" {...field} />
            </div>
          )}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => form.reset(initialData)}>
          Descartar cambios
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Publicando...' : 'Publicar actividad'}
        </Button>
      </div>
    </form>
  );
}