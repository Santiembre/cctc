"use client";
import {
  Bell,
  Bookmark,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Shield,
  TrendingUp,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = {
  estudiante: [
    { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    { href: "/perfil", label: "Mi perfil", icon: User },
    { href: "/perfil?tab=favoritos", label: "Favoritos", icon: Bookmark },
    { href: "/perfil?tab=recordatorios", label: "Recordatorios", icon: Bell },
  ],
  organizador: [
    { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
    {
      href: "/dashboard/organizer/nueva",
      label: "Nueva actividad",
      icon: BookOpen,
    },
    {
      href: "/dashboard/organizer/borradores",
      label: "Borradores",
      icon: FileText,
    },
    {
      href: "/dashboard/organizer/actividades",
      label: "Mis actividades",
      icon: Bookmark,
    },
  ],
  admin: [
    { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
    { href: "/dashboard/admin", label: "Administración", icon: Shield },
    {
      href: "/dashboard/admin?tab=metricas",
      label: "Métricas",
      icon: TrendingUp,
    },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  // In real implementation, get user role from context
  const role = "estudiante"; // Placeholder

  const items = navItems[role as keyof typeof navItems] || navItems.estudiante;

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-card h-full">
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </Link>
      </div>
    </aside>
  );
}
