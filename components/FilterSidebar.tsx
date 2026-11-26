"use client";
import { Calendar, Filter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TIPOS = ["taller", "curso", "club"] as const;
const AREAS = [
  "Programación",
  "Diseño",
  "Ciencias",
  "Humanidades",
  "Idiomas",
  "Deportes",
  "Artes",
  "Emprendimiento",
  "Otro",
];
const MODALIDADES = ["presencial", "virtual", "hibrido"] as const;

export function FilterSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const createQueryString = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) sp.set(key, value);
      else sp.delete(key);
    });
    return sp.toString();
  };

  const handleChange = (key: string, value: string) => {
    router.push(`${pathname}?${createQueryString({ [key]: value })}`);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = [
    "q",
    "tipo",
    "area",
    "modalidad",
    "fechaDesde",
    "fechaHasta",
    "costo",
  ].some((k) => searchParams.get(k));

  return (
    <aside
      className={cn(
        "fixed inset-0 z-40 flex lg:hidden",
        isOpen ? "block" : "hidden",
      )}
    >
      <button
        type="button"
        aria-label="Cerrar filtros"
        className="fixed inset-0 bg-black/50"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed left-0 top-0 h-full w-full max-w-sm bg-background shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Filtros</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <FilterSection searchParams={searchParams} onChange={handleChange} />
        </div>
        {hasFilters && (
          <div className="p-4 border-t">
            <Button variant="outline" className="w-full" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

function FilterSection({
  searchParams,
  onChange,
}: {
  searchParams: URLSearchParams;
  onChange: (k: string, v: string) => void;
}) {
  const uid = useId();
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${uid}-1`} className="block text-sm font-medium mb-1">
          Buscar
        </label>
        <Input
          id={`${uid}-1`}
          placeholder="Título, área, organizador..."
          value={searchParams.get("q") || ""}
          onChange={(e) => onChange("q", e.target.value)}
        />
      </div>

      <div>
        <label htmlFor={`${uid}-2`} className="block text-sm font-medium mb-1">
          Tipo
        </label>
        <Select
          value={searchParams.get("tipo") || ""}
          onValueChange={(v) => onChange("tipo", v || "")}
        >
          <SelectTrigger id={`${uid}-2`}>
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor={`${uid}-3`} className="block text-sm font-medium mb-1">
          Área
        </label>
        <Select
          value={searchParams.get("area") || ""}
          onValueChange={(v) => onChange("area", v || "")}
        >
          <SelectTrigger id={`${uid}-3`}>
            <SelectValue placeholder="Todas las áreas" />
          </SelectTrigger>
          <SelectContent>
            {AREAS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor={`${uid}-4`} className="block text-sm font-medium mb-1">
          Modalidad
        </label>
        <Select
          value={searchParams.get("modalidad") || ""}
          onValueChange={(v) => onChange("modalidad", v || "")}
        >
          <SelectTrigger id={`${uid}-4`}>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            {MODALIDADES.map((m) => (
              <SelectItem key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={`${uid}-5`}
            className="block text-sm font-medium mb-1"
          >
            Desde
          </label>
          <Input
            id={`${uid}-5`}
            type="date"
            value={searchParams.get("fechaDesde") || ""}
            onChange={(e) => onChange("fechaDesde", e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor={`${uid}-6`}
            className="block text-sm font-medium mb-1"
          >
            Hasta
          </label>
          <Input
            id={`${uid}-6`}
            type="date"
            value={searchParams.get("fechaHasta") || ""}
            onChange={(e) => onChange("fechaHasta", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-7`} className="block text-sm font-medium mb-1">
          Costo
        </label>
        <Select
          value={searchParams.get("costo") || ""}
          onValueChange={(v) => onChange("costo", v || "")}
        >
          <SelectTrigger id={`${uid}-7`}>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gratis">Solo gratis</SelectItem>
            <SelectItem value="pago">Con costo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function FilterBar() {
  const searchParams = useSearchParams();
  const [_isOpen, setIsOpen] = useState(false);
  const hasFilters = [
    "q",
    "tipo",
    "area",
    "modalidad",
    "fechaDesde",
    "fechaHasta",
    "costo",
  ].some((k) => searchParams.get(k));

  return (
    <div className="hidden lg:flex lg:items-center lg:gap-3 lg:p-4 lg:border-b sticky lg:top-0 lg:bg-background/95 lg:backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex-1 max-w-xs">
        <Input
          placeholder="Buscar actividades..."
          value={searchParams.get("q") || ""}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set("q", e.target.value);
            else params.delete("q");
            window.history.replaceState(null, "", `?${params.toString()}`);
          }}
        />
      </div>
      <Select
        value={searchParams.get("tipo") || ""}
        onValueChange={(v) => updateParam("tipo", v || "")}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          {TIPOS.map((t) => (
            <SelectItem key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("area") || ""}
        onValueChange={(v) => updateParam("area", v || "")}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Área" />
        </SelectTrigger>
        <SelectContent>
          {AREAS.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("modalidad") || ""}
        onValueChange={(v) => updateParam("modalidad", v || "")}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Modalidad" />
        </SelectTrigger>
        <SelectContent>
          {MODALIDADES.map((m) => (
            <SelectItem key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="hidden sm:flex">
        <Calendar className="h-4 w-4 mr-1" />
        Fecha
      </Button>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (window.location.href = window.location.pathname)}
        >
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
      <Button
        variant="outline"
        size="icon"
        className="lg:hidden"
        onClick={() => setIsOpen(true)}
      >
        <Filter className="h-4 w-4" />
      </Button>
    </div>
  );
}

function updateParam(key: string, value: string) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value);
  else params.delete(key);
  window.history.replaceState(null, "", `?${params.toString()}`);
}
