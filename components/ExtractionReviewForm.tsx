"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Calendar, Clock, Link2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Controller,
  type FieldErrors,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ReviewFormData, reviewFormSchema } from "@/lib/review-form";
import { cn } from "@/lib/utils";

const CONFIANZA_ALTA = 0.8;
const CONFIANZA_MEDIA = 0.5;
const PORCENTAJE = 100;
const DIAS_DURACION_CURSO_DEFAULT = 60;
const MS_POR_DIA = 24 * 60 * 60 * 1000; // eslint-disable-line ts-patterns/no-magic-numbers -- horas, minutos, segundos, ms

const ETIQUETAS_CAMPO: Readonly<Record<string, string>> = {
  titulo: "Título",
  tipo: "Tipo",
  area: "Área",
  descripcion: "Descripción",
  modalidad: "Modalidad",
  sede: "Sede",
  enlaceVirtual: "Enlace virtual",
  cupo: "Cupo máximo",
  costo: "Costo",
  moneda: "Moneda",
  requisitos: "Requisitos",
  enlaceInscripcion: "Enlace de inscripción",
  etiquetas: "Etiquetas",
  sesiones: "Sesiones",
  horarios: "Horarios",
  fechaInicio: "Fecha de inicio",
  fechaFin: "Fecha de fin",
};

/** Primer mensaje dentro de un error de react-hook-form (los arreglos anidan un error por fila). */
function primerMensaje(valor: unknown): string | undefined {
  if (typeof valor !== "object" || valor === null) return undefined;
  if (
    "message" in valor &&
    typeof valor.message === "string" &&
    valor.message
  ) {
    return valor.message;
  }
  // "ref" apunta al elemento del DOM: no contiene mensajes y puede ser circular.
  return Object.entries(valor)
    .filter(([clave]) => clave !== "ref")
    .map(([, hijo]) => primerMensaje(hijo))
    .find(Boolean);
}

function listarErrores(
  errores: FieldErrors<ReviewFormData>,
): readonly string[] {
  return Object.entries(errores).map(
    ([campo, error]) =>
      `${ETIQUETAS_CAMPO[campo] ?? campo}: ${primerMensaje(error) ?? "valor inválido"}`,
  );
}

/** Un <input type="number"> entrega texto; vacío significa "sin valor". */
function numeroOVacio(texto: string): number | undefined {
  return texto ? Number(texto) : undefined;
}

interface ExtractionReviewFormProps {
  initialData: Partial<ReviewFormData>;
  confidence: Record<string, number>;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function ExtractionReviewForm({
  initialData,
  confidence,
  onSubmit,
  isSubmitting,
}: ExtractionReviewFormProps) {
  const [tipo, setTipo] = useState(initialData.tipo || "taller");
  const isCursoTaller = tipo === "curso" || tipo === "taller";

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      titulo: "",
      tipo: "taller",
      area: "",
      descripcion: "",
      modalidad: "presencial",
      sede: "",
      enlaceVirtual: "",
      cupo: undefined,
      costo: 0,
      moneda: "GRATIS",
      requisitos: "",
      enlaceInscripcion: "",
      etiquetas: [],
      sesiones: [
        {
          fecha: new Date().toISOString().split("T")[0],
          horaInicio: "09:00",
          horaFin: "11:00",
        },
      ],
      horarios: [{ diaSemana: 1, horaInicio: "16:00", horaFin: "18:00" }],
      fechaInicio: "",
      fechaFin: "",
      ...initialData,
    },
    mode: "onChange",
  });

  const {
    fields: sesionesFields,
    append: appendSesion,
    remove: removeSesion,
  } = useFieldArray({ control: form.control, name: "sesiones" });
  const {
    fields: horariosFields,
    append: appendHorario,
    remove: removeHorario,
  } = useFieldArray({ control: form.control, name: "horarios" });
  const {
    fields: etiquetasFields,
    append: appendEtiqueta,
    remove: removeEtiqueta,
    // useFieldArray solo tipa arreglos de objetos y etiquetas es string[].
    // eslint-disable-next-line ts-patterns/no-explicit-any
  } = useFieldArray({ control: form.control as any, name: "etiquetas" });

  const getConfidence = (field: string) => confidence[field] ?? 1;
  const getConfidenceClass = (field: string) => {
    const c = getConfidence(field);
    if (c >= CONFIANZA_ALTA)
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (c >= CONFIANZA_MEDIA)
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  const handleTipoChange = (value: string) => {
    setTipo(value as ReviewFormData["tipo"]);
    form.setValue("tipo", value as ReviewFormData["tipo"], {
      shouldValidate: true,
    });
    if (value === "club") {
      form.setValue("sesiones", [
        {
          fecha: new Date().toISOString().split("T")[0],
          horaInicio: "09:00",
          horaFin: "11:00",
        },
      ]);
      form.setValue("fechaFin", "");
    } else {
      form.setValue("horarios", [
        { diaSemana: 1, horaInicio: "16:00", horaFin: "18:00" },
      ]);
      form.setValue(
        "fechaFin",
        new Date(Date.now() + DIAS_DURACION_CURSO_DEFAULT * MS_POR_DIA)
          .toISOString()
          .split("T")[0],
      );
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
          {(["taller", "curso", "club"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={tipo === t ? "default" : "outline"}
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
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Título *
              </label>
              <Input
                id={field.name}
                {...field}
                placeholder="Título de la actividad"
              />
              {getConfidence("titulo") < 1 && (
                <Badge
                  className={cn("mt-1", getConfidenceClass("titulo"))}
                  variant="secondary"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Confianza: {Math.round(getConfidence("titulo") * PORCENTAJE)}%
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
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Área *
              </label>
              <Select
                value={field.value || ""}
                onValueChange={(v) => field.onChange(v)}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue placeholder="Seleccionar área" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Programación",
                    "Diseño",
                    "Ciencias",
                    "Humanidades",
                    "Idiomas",
                    "Deportes",
                    "Artes",
                    "Emprendimiento",
                    "Otro",
                  ].map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
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
            <label
              htmlFor={field.name}
              className="block text-sm font-medium mb-1"
            >
              Descripción *
            </label>
            <Textarea
              id={field.name}
              {...field}
              rows={4}
              placeholder="Describe la actividad..."
            />
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="modalidad"
          control={form.control}
          render={({ field }) => (
            <div>
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Modalidad *
              </label>
              <Select
                value={field.value || "presencial"}
                onValueChange={(v) => field.onChange(v)}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue placeholder="Modalidad" />
                </SelectTrigger>
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
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Costo
              </label>
              <Input
                id={field.name}
                type="number"
                min="0"
                step="1"
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(numeroOVacio(e.target.value))}
                placeholder="0"
              />
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
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1 flex items-center gap-1"
              >
                Sede <MapPin className="h-3.5 w-3.5" />
              </label>
              <Input
                id={field.name}
                {...field}
                placeholder="Edificio, aula, campus"
              />
            </div>
          )}
        />
        <Controller
          name="enlaceVirtual"
          control={form.control}
          render={({ field }) => (
            <div>
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1 flex items-center gap-1"
              >
                Enlace virtual <Link2 className="h-3.5 w-3.5" />
              </label>
              <Input
                id={field.name}
                type="url"
                {...field}
                placeholder="https://meet.google.com/..."
              />
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
            <div
              key={sesion.id}
              className="grid gap-3 sm:grid-cols-4 items-end"
            >
              <Controller
                name={`sesiones.${index}.fecha`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Fecha
                    </label>
                    <Input id={field.name} type="date" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`sesiones.${index}.horaInicio`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Hora inicio
                    </label>
                    <Input id={field.name} type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`sesiones.${index}.horaFin`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Hora fin
                    </label>
                    <Input id={field.name} type="time" {...field} />
                  </div>
                )}
              />
              <div className="flex items-end">
                <Controller
                  name={`sesiones.${index}.tema`}
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex-1">
                      <label
                        htmlFor={field.name}
                        className="block text-sm font-medium mb-1"
                      >
                        Tema (opcional)
                      </label>
                      <Input
                        id={field.name}
                        {...field}
                        placeholder="Tema de la sesión"
                      />
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
                      <label
                        htmlFor={field.name}
                        className="block text-sm font-medium mb-1"
                      >
                        Sede (opcional)
                      </label>
                      <Input
                        id={field.name}
                        {...field}
                        placeholder="Edificio, aula"
                      />
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
                      <label
                        htmlFor={field.name}
                        className="block text-sm font-medium mb-1"
                      >
                        Enlace virtual (opcional)
                      </label>
                      <Input
                        id={field.name}
                        type="url"
                        {...field}
                        placeholder="https://meet.google.com/..."
                      />
                    </div>
                  )}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSesion(index)}
                  disabled={sesionesFields.length === 1}
                >
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendSesion({
                fecha: new Date().toISOString().split("T")[0],
                horaInicio: "09:00",
                horaFin: "11:00",
              })
            }
          >
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
            <div
              key={horario.id}
              className="grid gap-3 sm:grid-cols-5 items-end"
            >
              <Controller
                name={`horarios.${index}.diaSemana`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Día
                    </label>
                    <Select
                      value={String(field.value ?? "")}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder="Día" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Domingo",
                          "Lunes",
                          "Martes",
                          "Miércoles",
                          "Jueves",
                          "Viernes",
                          "Sábado",
                        ].map((d, i) => (
                          <SelectItem key={d} value={String(i)}>
                            {d}
                          </SelectItem>
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
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Inicio
                    </label>
                    <Input id={field.name} type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.horaFin`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Fin
                    </label>
                    <Input id={field.name} type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.sede`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Sede
                    </label>
                    <Input
                      id={field.name}
                      {...field}
                      placeholder="Edificio, aula"
                    />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.enlaceVirtual`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      Enlace virtual
                    </label>
                    <Input
                      id={field.name}
                      type="url"
                      {...field}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                )}
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHorario(index)}
                  disabled={horariosFields.length === 1}
                >
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendHorario({
                diaSemana: 1,
                horaInicio: "16:00",
                horaFin: "18:00",
              })
            }
          >
            + Agregar horario
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <p className="block text-sm font-medium">Etiquetas</p>
        <div className="flex flex-wrap gap-2">
          {etiquetasFields.map((etiqueta, index) => (
            <Badge key={etiqueta.id} variant="secondary" className="gap-1">
              <Controller
                name={`etiquetas.${index}`}
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    className="bg-transparent border-0 py-0 h-6 text-sm"
                    placeholder="Etiqueta"
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => removeEtiqueta(index)}
              >
                <AlertCircle className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            // Mismo caso que arriba: el campo es string[] aunque useFieldArray espere objetos.
            // eslint-disable-next-line ts-patterns/no-explicit-any
            onClick={() => appendEtiqueta("" as any)}
          >
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
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Cupo máximo
              </label>
              <Input
                id={field.name}
                type="number"
                min="1"
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(numeroOVacio(e.target.value))}
                placeholder="Sin límite"
              />
            </div>
          )}
        />
        <Controller
          name="enlaceInscripcion"
          control={form.control}
          render={({ field }) => (
            <div>
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Enlace de inscripción
              </label>
              <Input
                id={field.name}
                type="url"
                {...field}
                placeholder="https://forms.gle/..."
              />
            </div>
          )}
        />
      </div>

      <Controller
        name="requisitos"
        control={form.control}
        render={({ field }) => (
          <div>
            <label
              htmlFor={field.name}
              className="block text-sm font-medium mb-1"
            >
              Requisitos
            </label>
            <Textarea
              id={field.name}
              {...field}
              rows={3}
              placeholder="Conocimientos previos, materiales necesarios..."
            />
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="fechaInicio"
          control={form.control}
          render={({ field }) => (
            <div>
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Fecha de inicio *
              </label>
              <Input id={field.name} type="date" {...field} />
            </div>
          )}
        />
        <Controller
          name="fechaFin"
          control={form.control}
          render={({ field }) => (
            <div>
              <label
                htmlFor={field.name}
                className="block text-sm font-medium mb-1"
              >
                Fecha de fin
              </label>
              <Input id={field.name} type="date" {...field} />
            </div>
          )}
        />
      </div>

      {Boolean(form.formState.submitCount) &&
        Boolean(listarErrores(form.formState.errors).length) && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          >
            <p className="font-medium flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Completa estos campos antes de publicar:
            </p>
            <ul className="mt-1 list-disc pl-6">
              {listarErrores(form.formState.errors).map((mensaje) => (
                <li key={mensaje}>{mensaje}</li>
              ))}
            </ul>
          </div>
        )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset(initialData)}
        >
          Descartar cambios
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Publicando..." : "Publicar actividad"}
        </Button>
      </div>
    </form>
  );
}
