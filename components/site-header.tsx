"use client";

import { GraduationCap, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader(): ReactElement {
  const ruta = usePathname();
  const enPublicar = ruta.startsWith("/publicar");

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <span className="leading-tight">
            Hub de Aprendizaje
            <span className="block text-xs font-normal text-muted-foreground">
              FES Acatlán
            </span>
          </span>
        </Link>

        <nav
          className="flex items-center gap-1 sm:gap-2"
          aria-label="Principal"
        >
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              !enPublicar && "bg-muted text-foreground",
            )}
          >
            Catálogo
          </Link>
          <Link
            href="/publicar"
            className={cn(
              buttonVariants({ variant: enPublicar ? "secondary" : "default" }),
            )}
          >
            <Plus aria-hidden />
            <span className="hidden sm:inline">Publicar actividad</span>
            <span className="sm:hidden">Publicar</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
