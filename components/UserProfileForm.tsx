"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const profileSchema = z.object({
  nombre: z.string().min(2).max(100),
  carrera: z.string().max(100).optional(),
});

export function UserProfileForm() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { nombre: "", carrera: "" },
    mode: "onChange",
  });

  const onSubmit = async (_data: z.infer<typeof profileSchema>) => {
    setSaving(true);
    try {
      // In real implementation, call API to update profile
      await new Promise((r) => setTimeout(r, 1000));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
      <div className="rounded-lg border p-6">
        <h3 className="font-medium mb-4">Información personal</h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="perfil-1"
              className="block text-sm font-medium mb-1"
            >
              Nombre completo
            </label>
            <Input
              id="perfil-1"
              {...form.register("nombre")}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label
              htmlFor="perfil-2"
              className="block text-sm font-medium mb-1"
            >
              Carrera
            </label>
            <Input
              id="perfil-2"
              {...form.register("carrera")}
              placeholder="Tu carrera"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => form.reset()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Guardado
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </div>
    </form>
  );
}
