"use client";
import { onAuthStateChanged } from "firebase/auth";
import { BookOpen, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{
    uid: string;
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    // Sin configuración de Firebase no hay sesión que escuchar.
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || "",
          role: "estudiante",
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const navigation = [
    { name: "Catálogo", href: "/" },
    { name: "Cómo funciona", href: "/como-funciona" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4"
        aria-label="Global"
      >
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl"
            aria-label="Hub de Aprendizaje"
          >
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="hidden sm:block">Hub de Aprendizaje</span>
          </Link>

          <div className="hidden md:flex md:gap-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="hidden sm:flex sm:items-center sm:gap-4">
              <Link
                href="/perfil"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {user.email}
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Panel
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  /* signOut */
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="hidden sm:flex sm:items-center sm:gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-4xl border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/dashboard/organizer/nueva"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Publicar actividad
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t px-4 py-4 space-y-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          {!user && (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-4xl border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 w-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                Iniciar sesión
              </Link>
              <Link
                href="/dashboard/organizer/nueva"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 w-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                Publicar actividad
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
