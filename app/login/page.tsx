"use client";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"estudiante" | "organizador">("estudiante");

  const handleGoogleSignIn = async () => {
    // `auth` solo existe en el navegador y con las variables NEXT_PUBLIC_FIREBASE_* definidas;
    // por eso se usa aquí y no durante el render (que también corre en el servidor).
    if (!auth) {
      setError(
        "El inicio de sesión no está disponible: falta configurar Firebase.",
      );
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: "acatlan.unam.mx" }); // Restrict to institutional domain

    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const response = await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error en autenticación");
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Iniciar sesión</h1>
          <p className="text-muted-foreground mt-2">
            Usa tu cuenta institucional @acatlan.unam.mx
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-3">¿Cómo ingresarás?</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={role === "estudiante" ? "default" : "outline"}
                  onClick={() => setRole("estudiante")}
                  className="h-20 flex flex-col gap-2"
                >
                  <Mail className="h-6 w-6 mx-auto" />
                  Estudiante
                </Button>
                <Button
                  variant={role === "organizador" ? "default" : "outline"}
                  onClick={() => setRole("organizador")}
                  className="h-20 flex flex-col gap-2"
                >
                  <Lock className="h-6 w-6 mx-auto" />
                  Organizador
                </Button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Continuar con Google"
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Al continuar, aceptas los{" "}
          <a href="/terminos" className="underline">
            Términos de uso
          </a>{" "}
          y la{" "}
          <a href="/privacidad" className="underline">
            Política de privacidad
          </a>
        </p>
      </div>
    </div>
  );
}
