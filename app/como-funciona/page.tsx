import { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import {
  FileText,
  UploadCloud,
  Search,
  CheckCircle,
  Calendar,
  User,
  Clock,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cómo funciona | Hub de Aprendizaje FES Acatlán",
  description:
    "Descubre cómo usar el Hub de Aprendizaje: busca actividades, sube tus eventos con IA y gestiona tus favoritos.",
};

const steps = [
  {
    number: "01",
    title: "Explora el catálogo",
    description:
      "Navega por talleres, cursos y clubes. Usa filtros por tipo, área, modalidad, fechas y costo para encontrar lo que buscas.",
    icon: Search,
  },
  {
    number: "02",
    title: "Guarda tus favoritos",
    description:
      "Marca actividades con el icono de corazón. Recibe recordatorios automáticos un día antes de que inicien.",
    icon: CheckCircle,
  },
  {
    number: "03",
    title: "Inscríbete fácilmente",
    description:
      "Cada actividad tiene su enlace de inscripción directo. Un clic y estás dentro.",
    icon: User,
  },
];

const organizerSteps = [
  {
    number: "01",
    title: "Sube tu PDF o imagen",
    description:
      "Arrastra el cartel o convocatoria. La IA extrae título, fechas, horarios, sede, cupo, requisitos y más.",
    icon: UploadCloud,
  },
  {
    number: "02",
    title: "Revisa y corrige",
    description:
      "La IA muestra su nivel de confianza por campo. Los datos dudosos se marcan en amarillo para que los verifiques.",
    icon: Zap,
  },
  {
    number: "03",
    title: "Publica en un clic",
    description:
      "Una vez revisado, publícalo. Aparece inmediatamente en el catálogo para toda la comunidad.",
    icon: Shield,
  },
];

const features = [
  {
    icon: Calendar,
    title: "Fechas inteligentes",
    desc: "Soporta cursos con múltiples sesiones, talleres de un día y clubes recurrentes semanales.",
  },
  {
    icon: Clock,
    title: "Recordatorios automáticos",
    desc: "Recibe notificación un día antes de cada actividad guardada en favoritos.",
  },
  {
    icon: Zap,
    title: "IA multimodal",
    desc: "Lee PDFs, fotos de carteles y flyers. Entiende diseños libres, no solo texto estructurado.",
  },
  {
    icon: Shield,
    title: "Privacidad y seguridad",
    desc: "Datos mínimos, cifrado en reposo, acceso por roles. Cumple LFPDPPP mexicana.",
  },
];

export default function ComoFuncionaPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 via-background to-background py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
              ¿Cómo funciona el{" "}
              <span className="text-primary">Hub de Aprendizaje</span>?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Una plataforma centralizada donde estudiantes encuentran actividades y organizadores
              publican en segundos con ayuda de IA.
            </p>
          </div>
        </section>

        {/* Para estudiantes */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Para <span className="text-primary">estudiantes</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Encuentra, guarda e inscríbete en talleres, cursos y clubes en tres pasos.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3 pt-6 overflow-visible">
                          {steps.map((step) => (
                            <div
                              key={step.number}
                              className="p-6 rounded-2xl border bg-card hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                                  <step.icon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                                      {step.number}
                                    </span>
                                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{step.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
          </div>
        </section>

        {/* Para organizadores */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Para <span className="text-primary">organizadores</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Publica tu actividad en menos de un minuto. La IA hace el trabajo pesado.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3 pt-6 overflow-visible">
              {organizerSteps.map((step) => (
                <div
                  key={step.number}
                  className="p-6 rounded-2xl border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                      <step.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                          {step.number}
                        </span>
                        <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/dashboard/organizer/nueva"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <UploadCloud className="h-5 w-5 mr-2" />
                Probar ahora → Subir actividad con IA
              </Link>
            </div>
          </div>
        </section>

        {/* Características clave */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Características <span className="text-primary">clave</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Diseñado para la comunidad de la FES Acatlán.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="mb-3 p-2 rounded-lg bg-primary/10 w-fit">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-primary/5">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              ¿Listo para empezar?
            </h2>
            <p className="text-muted-foreground mb-8">
              Únete a la comunidad de aprendizaje de la FES Acatlán.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-4xl border border-transparent bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Explorar catálogo
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
              <Link
                href="/dashboard/organizer/nueva"
                className="inline-flex items-center justify-center rounded-4xl border border-primary bg-background px-6 py-3 text-base font-medium text-primary hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Publicar actividad
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}